import { Request, Response } from "express";
import { Transaction, fn, col, where } from "sequelize";
import { sequelize } from "../database/connect";
import User from "../models/users";
import Subscription from "../models/suscriptions";
import { markMercadoPagoCancelled } from "../utils/subscription-status";
import {
  ADDONS,
  AddonKey,
  addonEntries,
  addonsTotal,
  getPreapproval,
  isAddonKey,
  normalizeAddons,
  setPreapprovalAmount,
  subscriptionTotal,
} from "../utils/addons";
import {
  PriceError,
  cancelPriceChange,
  getAddonPrice,
  newAddonEntry,
  pricingSummary,
  retryPriceChange,
  schedulePriceChange,
  scheduledChange,
} from "../utils/addon-prices";

/**
 * Complementos de la suscripción, pedidos por el backend del panel de tiendas
 * (servidor a servidor, ver validateService). La tienda se identifica con el
 * correo de su cuenta de VendeYaOnline.
 *
 * - quote: qué paga hoy y cuánto pagaría con el complemento.
 * - activate / cancel: cambian el monto del preapproval en Mercado Pago y,
 *   solo si eso funciona, guardan el complemento. El cobro nuevo aplica desde
 *   la siguiente mensualidad (Mercado Pago no cobra la diferencia ahora).
 * - cancel no lo quita de una vez: queda activo hasta el próximo cobro
 *   (cancel_at, el mes ya pagado) y ese cobro sale sin él. Activar antes de
 *   esa fecha lo reactiva con su mismo precio.
 * - pricing/*: el superadmin controla el precio (ver utils/addon-prices.ts).
 */

/** Estados en los que se puede cambiar el monto (igual que updatedPlan). */
const EDITABLE_STATUSES = ["active", "pause"];

class AddonError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const parseBody = (body: any) => {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !email.includes("@")) {
    throw new AddonError(400, "EMAIL_INVALID", "Correo de la cuenta inválido.");
  }
  if (!isAddonKey(body?.addon)) {
    throw new AddonError(400, "ADDON_INVALID", "Complemento desconocido.");
  }
  return { email, addon: body.addon as AddonKey };
};

/** Usuario y su suscripción (bloqueada para escribir si va en una transacción). */
const findAccount = async (email: string, transaction?: Transaction) => {
  const user = await User.findOne({
    where: where(fn("lower", col("email")), email),
    transaction,
  });
  if (!user) return { user: null, subscription: null };
  const subscription = await Subscription.findOne({
    where: { client: user.getDataValue("id") },
    order: [["id", "DESC"]],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  return { user, subscription };
};

const summary = async (subscription: any, addon: AddonKey, nextPaymentDate: string | null = null) => {
  const price = Number(subscription.getDataValue("price"));
  const raw = subscription.getDataValue("addons");
  const entry = addonEntries(raw).find((item) => item.key === addon);
  const [currentPrice, scheduled] = await Promise.all([getAddonPrice(addon), scheduledChange(addon)]);
  return {
    subscription: {
      type: subscription.getDataValue("type"),
      status: subscription.getDataValue("status"),
      plan_price: price,
      addons: normalizeAddons(raw),
      addons_total: addonsTotal(raw),
      total: subscriptionTotal(price, raw),
      next_payment_date: nextPaymentDate,
    },
    // Si ya lo tiene, el precio con el que lo activó; si no, el vigente.
    addon: {
      key: addon,
      label: ADDONS[addon].label,
      price: entry?.price ?? currentPrice,
      active: Boolean(entry),
      // Cancelado al terminar el mes: activo hasta esta fecha.
      cancel_at: entry?.cancel_at ?? null,
    },
    // Cambio de precio programado (para el aviso de la tienda).
    price_change: scheduled ? { price: scheduled.getDataValue("new_price"), effective_at: scheduled.getDataValue("effective_at") } : null,
  };
};

/** Próximo cobro según Mercado Pago (null si no responde). */
const nextPaymentOf = async (subscription: any) => {
  try {
    return (await getPreapproval(subscription.getDataValue("subscriptionId")))?.next_payment_date ?? null;
  } catch {
    return null;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const sendError = (res: Response, error: any, context: string) => {
  if (error instanceof AddonError || error instanceof PriceError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  // Errores de Mercado Pago: sin datos sensibles, solo el mensaje.
  const mpMessage = error?.response?.data?.message;
  console.error(`[ADDONS] ${context}:`, mpMessage ?? error?.message ?? error);
  return res.status(502).json({
    code: "MERCADOPAGO_ERROR",
    message: "No se pudo actualizar la suscripción en Mercado Pago. Intenta de nuevo en unos minutos.",
  });
};

/** POST /api/service/addons/quote — `eligible` dice si puede activarlo solo. */
export const quoteAddon = async (req: Request, res: Response) => {
  try {
    const { email, addon } = parseBody(req.body);
    const { user, subscription } = await findAccount(email);
    if (!user) return res.status(200).json({ eligible: false, reason: "ACCOUNT_NOT_FOUND" });
    if (!subscription) return res.status(200).json({ eligible: false, reason: "NO_SUBSCRIPTION" });

    // La fecha del próximo cobro es informativa: si Mercado Pago no responde, no bloquea.
    const nextPaymentDate = await nextPaymentOf(subscription);
    const editable = EDITABLE_STATUSES.includes(subscription.getDataValue("status"));
    return res.status(200).json({
      eligible: editable,
      reason: editable ? null : "SUBSCRIPTION_NOT_ACTIVE",
      ...(await summary(subscription, addon, nextPaymentDate)),
    });
  } catch (error) {
    return sendError(res, error, "quote");
  }
};

/**
 * Suma o quita el complemento. Con la fila de la suscripción bloqueada, así dos
 * pedidos a la vez no cobran doble ni dejan el monto desfasado.
 */
const changeAddon = (mode: "activate" | "cancel") => async (req: Request, res: Response) => {
  try {
    const { email, addon } = parseBody(req.body);
    const result = await sequelize.transaction(async (transaction) => {
      const { user, subscription } = await findAccount(email, transaction);
      if (!user) throw new AddonError(404, "ACCOUNT_NOT_FOUND", "No existe una cuenta de VendeYaOnline con ese correo.");
      if (!subscription) throw new AddonError(409, "NO_SUBSCRIPTION", "La cuenta no tiene una suscripción.");
      const status = subscription.getDataValue("status");
      if (!EDITABLE_STATUSES.includes(status)) {
        throw new AddonError(409, "SUBSCRIPTION_NOT_ACTIVE", "La suscripción no está activa.");
      }

      const current = addonEntries(subscription.getDataValue("addons"));
      const entry = current.find((item) => item.key === addon);
      // Idempotente: repetir el pedido no vuelve a cambiar el cobro.
      const alreadyActive = mode === "activate" && entry && !entry.cancel_at;
      const alreadyCanceled = mode === "cancel" && (!entry || entry.cancel_at);
      if (alreadyActive || alreadyCanceled) {
        return { changed: false, ...(await summary(subscription, addon)) };
      }

      let next;
      if (mode === "activate") {
        // Reactivar antes de que venza la cancelación: mismo precio. Si no, el vigente.
        next = entry ? current.map((item) => (item.key === addon ? { ...item, cancel_at: null } : item)) : [...current, await newAddonEntry(addon)];
      } else {
        // Sigue activo hasta el próximo cobro (el mes ya pagado); ese cobro sale sin él.
        const nextPayment = await nextPaymentOf(subscription);
        const cancelAt = nextPayment && new Date(nextPayment).getTime() > Date.now() ? new Date(nextPayment) : new Date(Date.now() + 30 * DAY_MS);
        next = current.map((item) => (item.key === addon ? { ...item, cancel_at: cancelAt.toISOString() } : item));
      }
      const price = Number(subscription.getDataValue("price"));
      const subscriptionId = subscription.getDataValue("subscriptionId");
      const type = subscription.getDataValue("type");
      const finalStatus = status === "pause" ? "paused" : "authorized";

      // Primero Mercado Pago; la BD solo cambia si eso funcionó.
      await setPreapprovalAmount(subscriptionId, type, subscriptionTotal(price, next), finalStatus);
      try {
        await subscription.update({ addons: next }, { transaction });
      } catch (dbError) {
        // Si no se pudo guardar, se devuelve el monto anterior en Mercado Pago.
        await setPreapprovalAmount(subscriptionId, type, subscriptionTotal(price, current), finalStatus).catch(() => {});
        throw dbError;
      }
      console.log(`[ADDONS] ${mode} ${addon} para la suscripción ${subscription.getDataValue("id")}`);
      return { changed: true, ...(await summary(subscription, addon)) };
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, mode);
  }
};

/** POST /api/service/addons/activate */
export const activateAddon = changeAddon("activate");

/** POST /api/service/addons/cancel */
export const cancelAddon = changeAddon("cancel");

/**
 * POST /api/service/account/status — estado de la suscripción de una cuenta,
 * para que el panel de tiendas bloquee vistas de pago si se canceló y avise si
 * Mercado Pago no logra cobrar. `preapproval_status` y `payment_issue` son null
 * si Mercado Pago no respondió (estado desconocido: el panel no toca nada).
 */
export const accountStatus = async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !email.includes("@")) {
      throw new AddonError(400, "EMAIL_INVALID", "Correo de la cuenta inválido.");
    }
    const { user, subscription } = await findAccount(email);
    if (!user) return res.status(200).json({ account: false, subscription: null });
    if (!subscription) return res.status(200).json({ account: true, subscription: null });

    let preapproval: any = null;
    try {
      preapproval = await getPreapproval(subscription.getDataValue("subscriptionId"));
    } catch {
      preapproval = null;
    }
    // El aviso de cancelación de Mercado Pago puede no haber llegado nunca: se registra aquí.
    if (preapproval?.status === "cancelled" && (await markMercadoPagoCancelled(subscription.getDataValue("subscriptionId")))) {
      await subscription.reload();
    }
    // Semáforo de cobros de Mercado Pago: green = al día; yellow/red = cobros fallidos.
    const semaphore = preapproval?.summarized?.semaphore ?? null;
    const raw = subscription.getDataValue("addons");
    const priceChanges: Record<string, { price: number; effective_at: Date }> = {};
    for (const key of normalizeAddons(raw)) {
      const scheduled = await scheduledChange(key);
      if (scheduled) priceChanges[key] = { price: scheduled.getDataValue("new_price"), effective_at: scheduled.getDataValue("effective_at") };
    }
    return res.status(200).json({
      account: true,
      subscription: {
        type: subscription.getDataValue("type"),
        status: subscription.getDataValue("status"),
        addons: normalizeAddons(raw),
        // Precio de cada complemento y si se canceló (activo hasta cancel_at).
        addon_details: addonEntries(raw),
        // Subidas de precio programadas de sus complementos (aviso a la tienda).
        price_changes: priceChanges,
        preapproval_status: preapproval?.status ?? null,
        payment_issue: preapproval ? semaphore === "yellow" || semaphore === "red" : null,
        next_payment_date: preapproval?.next_payment_date ?? null,
      },
    });
  } catch (error) {
    return sendError(res, error, "status");
  }
};

// ---------------------------------------------------------------------------
// Precio de los complementos (superadmin del panel de tiendas)

const parseAddon = (body: any) => {
  if (!isAddonKey(body?.addon)) throw new AddonError(400, "ADDON_INVALID", "Complemento desconocido.");
  return body.addon as AddonKey;
};

const pricingAction = (action: (body: any, key: AddonKey) => Promise<unknown>, context: string) => async (req: Request, res: Response) => {
  try {
    const key = parseAddon(req.body);
    const result = await action(req.body, key);
    return res.status(200).json({ result, pricing: await pricingSummary(key) });
  } catch (error) {
    return sendError(res, error, context);
  }
};

/** POST /api/service/addons/pricing — precio vigente, quién lo paga, cambio programado y el último aplicado. */
export const getPricing = pricingAction(async () => null, "pricing");

/** POST /api/service/addons/pricing/schedule — { addon, price, effective_at, created_by }. */
export const schedulePricing = pricingAction(
  (body, key) => schedulePriceChange({ key, price: Number(body?.price), effectiveAt: body?.effective_at, createdBy: body?.created_by ?? null }),
  "pricing/schedule",
);

/** POST /api/service/addons/pricing/cancel — cancela el cambio programado. */
export const cancelPricing = pricingAction((_body, key) => cancelPriceChange(key), "pricing/cancel");

/** POST /api/service/addons/pricing/retry — reintenta las suscripciones que fallaron. */
export const retryPricing = pricingAction((_body, key) => retryPriceChange(key), "pricing/retry");
