import { Request, Response } from "express";
import { Transaction, fn, col, where } from "sequelize";
import { sequelize } from "../database/connect";
import User from "../models/users";
import Subscription from "../models/suscriptions";
import {
  ADDONS,
  AddonKey,
  addonsTotal,
  getPreapproval,
  isAddonKey,
  normalizeAddons,
  setPreapprovalAmount,
  subscriptionTotal,
} from "../utils/addons";

/**
 * Complementos de la suscripción, pedidos por el backend del panel de tiendas
 * (servidor a servidor, ver validateService). La tienda se identifica con el
 * correo de su cuenta de VendeYaOnline.
 *
 * - quote: qué paga hoy y cuánto pagaría con el complemento.
 * - activate / cancel: cambian el monto del preapproval en Mercado Pago y,
 *   solo si eso funciona, guardan el complemento. El cobro nuevo aplica desde
 *   la siguiente mensualidad (Mercado Pago no cobra la diferencia ahora).
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

const summary = (subscription: any, addon: AddonKey, nextPaymentDate: string | null = null) => {
  const price = Number(subscription.getDataValue("price"));
  const addons = normalizeAddons(subscription.getDataValue("addons"));
  return {
    subscription: {
      type: subscription.getDataValue("type"),
      status: subscription.getDataValue("status"),
      plan_price: price,
      addons,
      addons_total: addonsTotal(addons),
      total: subscriptionTotal(price, addons),
      next_payment_date: nextPaymentDate,
    },
    addon: { key: addon, ...ADDONS[addon], active: addons.includes(addon) },
  };
};

const sendError = (res: Response, error: any, context: string) => {
  if (error instanceof AddonError) {
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
    let nextPaymentDate: string | null = null;
    try {
      nextPaymentDate = (await getPreapproval(subscription.getDataValue("subscriptionId")))?.next_payment_date ?? null;
    } catch {
      nextPaymentDate = null;
    }
    const editable = EDITABLE_STATUSES.includes(subscription.getDataValue("status"));
    return res.status(200).json({
      eligible: editable,
      reason: editable ? null : "SUBSCRIPTION_NOT_ACTIVE",
      ...summary(subscription, addon, nextPaymentDate),
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

      const current = normalizeAddons(subscription.getDataValue("addons"));
      const has = current.includes(addon);
      // Idempotente: repetir el pedido no vuelve a cambiar el cobro.
      if ((mode === "activate" && has) || (mode === "cancel" && !has)) {
        return { changed: false, ...summary(subscription, addon) };
      }

      const next = mode === "activate" ? [...current, addon] : current.filter((key) => key !== addon);
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
      return { changed: true, ...summary(subscription, addon) };
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
