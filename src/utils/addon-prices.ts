import { DataTypes, Op } from "sequelize";
import { sequelize } from "../database/connect";
import Subscription from "../models/suscriptions";
import User from "../models/users";
import { ADDONS, AddonEntry, AddonKey, addonEntries, setPreapprovalAmount, subscriptionTotal } from "./addons";

/**
 * Precio de los complementos (p. ej. Marketing), controlado por el
 * superadministrador desde el panel de tiendas.
 *
 * - El precio vigente es el del último cambio aplicado (o ADDONS si no hay).
 * - Subir el precio se PROGRAMA con al menos MIN_NOTICE_DAYS de aviso: la
 *   tienda ve el aviso y recibe un correo (los manda el backend de tiendas) y
 *   puede cancelar antes. En la fecha, applyDueChanges actualiza el monto de
 *   cada suscripción en Mercado Pago y el precio guardado en su complemento.
 * - Bajar el precio se aplica de inmediato, pero solo a quien paga más que el
 *   precio nuevo. Quien paga menos (lo activó cuando era más barato) conserva
 *   su precio: una rebaja nunca le sube el cobro a nadie sin el aviso.
 * - Suscripciones pausadas: no se tocan (quedan en "paused" del resultado);
 *   el superadmin las revisa a mano. Las que ya cancelaron el complemento
 *   (cancel_at) tampoco: no se les vuelve a cobrar.
 * - Si Mercado Pago falla con una, conserva su precio anterior: nunca se cobra
 *   de más por error. Se puede reintentar.
 */

export const MIN_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const AddonPriceChange = sequelize.define(
  "AddonPriceChange",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    addon: { type: DataTypes.STRING, allowNull: false },
    old_price: { type: DataTypes.INTEGER, allowNull: false },
    new_price: { type: DataTypes.INTEGER, allowNull: false },
    effective_at: { type: DataTypes.DATE, allowNull: false },
    /** scheduled → applying → applied | canceled */
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "scheduled" },
    /** { updated: [...], failed: [...], paused: [...], kept: [...] } */
    results: { type: DataTypes.JSON, allowNull: true },
    created_by: { type: DataTypes.STRING, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    applied_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "addon_price_changes", timestamps: false },
);

export class PriceError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Precio vigente: el del último cambio aplicado, o el de ADDONS. */
export const getAddonPrice = async (key: AddonKey) => {
  const last = await AddonPriceChange.findOne({
    where: { addon: key, status: "applied" },
    order: [["applied_at", "DESC"], ["id", "DESC"]],
  });
  return last ? Number(last.getDataValue("new_price")) : ADDONS[key].price;
};

/** Entrada nueva con el precio vigente. */
export const newAddonEntry = async (key: AddonKey): Promise<AddonEntry> => ({ key, price: await getAddonPrice(key), cancel_at: null });

/** Cambio programado (aún no aplicado), o null. */
export const scheduledChange = async (key: AddonKey) =>
  AddonPriceChange.findOne({ where: { addon: key, status: "scheduled" }, order: [["id", "DESC"]] });

const changeJson = (change: any) =>
  change
    ? {
        id: change.getDataValue("id"),
        old_price: change.getDataValue("old_price"),
        new_price: change.getDataValue("new_price"),
        effective_at: change.getDataValue("effective_at"),
        status: change.getDataValue("status"),
        created_at: change.getDataValue("created_at"),
        applied_at: change.getDataValue("applied_at"),
        results: change.getDataValue("results") ?? null,
      }
    : null;

/** Suscripciones con el complemento activo y cobrándose (sin cancelación), con el correo de su cuenta. */
const billedSubscriptions = async (key: AddonKey) => {
  const subscriptions = await Subscription.findAll({ include: [{ model: User, attributes: ["email"] }] });
  return subscriptions.filter((subscription: any) =>
    addonEntries(subscription.getDataValue("addons")).some((entry) => entry.key === key && !entry.cancel_at),
  );
};

/** Resumen para el superadmin: precio vigente, quién lo paga y a cuánto, y el cambio programado o el último. */
export const pricingSummary = async (key: AddonKey) => {
  const [price, scheduled, last, subscriptions] = await Promise.all([
    getAddonPrice(key),
    scheduledChange(key),
    AddonPriceChange.findOne({ where: { addon: key, status: { [Op.in]: ["applied", "applying"] } }, order: [["id", "DESC"]] }),
    billedSubscriptions(key),
  ]);
  const byPrice = new Map<number, number>();
  for (const subscription of subscriptions as any[]) {
    const entry = addonEntries(subscription.getDataValue("addons")).find((item) => item.key === key)!;
    byPrice.set(entry.price, (byPrice.get(entry.price) ?? 0) + 1);
  }
  return {
    addon: key,
    label: ADDONS[key].label,
    price,
    min_notice_days: MIN_NOTICE_DAYS,
    subscribers: {
      total: subscriptions.length,
      by_price: [...byPrice.entries()].map(([value, count]) => ({ price: value, count })).sort((a, b) => a.price - b.price),
      // Cuentas que lo pagan (el panel de tiendas les avisa de una subida).
      emails: (subscriptions as any[]).map((subscription) => subscription.User?.email?.toLowerCase()).filter(Boolean),
    },
    scheduled: changeJson(scheduled),
    last: changeJson(last),
  };
};

/** Aplica un cambio a una suscripción (con su fila bloqueada). */
const applyToSubscription = async (subscriptionId: number, key: AddonKey, newPrice: number, lowerOnly: boolean) =>
  sequelize.transaction(async (transaction) => {
    const subscription: any = await Subscription.findByPk(subscriptionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!subscription) return "gone";
    const entries = addonEntries(subscription.getDataValue("addons"));
    const entry = entries.find((item) => item.key === key);
    if (!entry || entry.cancel_at) return "canceled";
    if (entry.price === newPrice) return "updated";
    // Rebaja: quien ya paga menos que el precio nuevo no sube.
    if (lowerOnly && entry.price < newPrice) return "kept";
    if (subscription.getDataValue("status") !== "active") return "paused";
    const next = entries.map((item) => (item.key === key ? { ...item, price: newPrice } : item));
    // Primero Mercado Pago; la base solo cambia si eso funcionó.
    await setPreapprovalAmount(
      subscription.getDataValue("subscriptionId"),
      subscription.getDataValue("type"),
      subscriptionTotal(Number(subscription.getDataValue("price")), next),
      "authorized",
    );
    await subscription.update({ addons: next }, { transaction });
    return "updated";
  });

let running = false;

/**
 * Aplica un cambio a todas las suscripciones que pagan el complemento.
 * `onlyFailed`: reintenta solo las que fallaron la vez anterior.
 */
export const applyChange = async (change: any, { onlyFailed = false } = {}) => {
  const key = change.getDataValue("addon") as AddonKey;
  const newPrice = Number(change.getDataValue("new_price"));
  const lowerOnly = newPrice < Number(change.getDataValue("old_price"));
  const previous = change.getDataValue("results") ?? { updated: [], failed: [], paused: [], kept: [] };
  await change.update({ status: "applying" });

  const targets = onlyFailed
    ? previous.failed.map((item: any) => item.subscription_id)
    : (await billedSubscriptions(key)).map((subscription: any) => subscription.getDataValue("id"));
  const emails = new Map<number, string | null>();
  for (const subscription of (await Subscription.findAll({ where: { id: targets }, include: [{ model: User, attributes: ["email"] }] })) as any[]) {
    emails.set(subscription.getDataValue("id"), subscription.User?.email ?? null);
  }

  const results = onlyFailed
    ? { kept: [] as any[], ...previous, failed: [] as any[] }
    : { updated: [] as any[], failed: [] as any[], paused: [] as any[], kept: [] as any[] };
  for (const id of targets) {
    const item = { subscription_id: id, email: emails.get(id) ?? null };
    try {
      const outcome = await applyToSubscription(id, key, newPrice, lowerOnly);
      if (outcome === "updated") results.updated.push(item);
      else if (outcome === "paused") results.paused.push(item);
      else if (outcome === "kept") results.kept.push(item);
    } catch (error: any) {
      // Sin datos sensibles: solo el mensaje de Mercado Pago.
      results.failed.push({ ...item, error: String(error?.response?.data?.message ?? error?.message ?? error).slice(0, 200) });
    }
  }
  await change.update({ status: "applied", results, applied_at: change.getDataValue("applied_at") ?? new Date() });
  console.log(
    `[PRECIOS] ${key}: ${results.updated.length} actualizadas, ${results.failed.length} fallidas, ${results.paused.length} pausadas, ${results.kept.length} conservan su precio`,
  );
  return changeJson(change);
};

/** Aplica los cambios cuya fecha ya llegó (cada hora y al arrancar). */
export const applyDueChanges = async () => {
  if (running) return;
  running = true;
  try {
    // "applying" = se cortó a mitad (p. ej. reinicio): se retoma; las ya actualizadas se saltan.
    const due = await AddonPriceChange.findAll({ where: { status: { [Op.in]: ["scheduled", "applying"] }, effective_at: { [Op.lte]: new Date() } } });
    for (const change of due) await applyChange(change);
  } finally {
    running = false;
  }
};

/**
 * Programa un cambio de precio. Subir: fecha con al menos MIN_NOTICE_DAYS de
 * aviso. Bajar: se aplica ya (effective_at = ahora). Reemplaza el programado.
 */
export const schedulePriceChange = async ({ key, price, effectiveAt, createdBy }: { key: AddonKey; price: number; effectiveAt?: string; createdBy?: string | null }) => {
  if (!Number.isInteger(price) || price < 1000 || price > 10_000_000) {
    throw new PriceError(400, "PRICE_INVALID", "El precio debe ser un número entero de pesos, entre 1.000 y 10.000.000.");
  }
  const current = await getAddonPrice(key);
  if (price === current) throw new PriceError(400, "PRICE_UNCHANGED", "Ese ya es el precio actual.");

  let when = new Date();
  if (price > current) {
    when = new Date(effectiveAt ?? "");
    if (Number.isNaN(when.getTime())) throw new PriceError(400, "DATE_INVALID", "Elige la fecha desde la que aplica el precio nuevo.");
    // Un minuto de margen por la hora del navegador.
    if (when.getTime() < Date.now() + MIN_NOTICE_DAYS * DAY_MS - 60_000) {
      throw new PriceError(400, "NOTICE_TOO_SHORT", `Para subir el precio hay que avisar con al menos ${MIN_NOTICE_DAYS} días de anticipación.`);
    }
  }

  const previous = await scheduledChange(key);
  if (previous) await previous.update({ status: "canceled" });
  const change = await AddonPriceChange.create({
    addon: key,
    old_price: current,
    new_price: price,
    effective_at: when,
    status: "scheduled",
    created_by: createdBy ?? null,
  });
  // Bajar el precio: de una vez (solo a quien paga más).
  if (price < current) await applyChange(change);
  return { change: changeJson(change), immediate: price < current, increase: price > current };
};

/** Cancela el cambio programado (si no se ha aplicado). */
export const cancelPriceChange = async (key: AddonKey) => {
  const change = await scheduledChange(key);
  if (!change) throw new PriceError(404, "NO_SCHEDULED_CHANGE", "No hay un cambio de precio programado.");
  await change.update({ status: "canceled" });
  return changeJson(change);
};

/** Reintenta las suscripciones que fallaron en el último cambio aplicado. */
export const retryPriceChange = async (key: AddonKey) => {
  const change = await AddonPriceChange.findOne({ where: { addon: key, status: "applied" }, order: [["id", "DESC"]] });
  if (!change || !(change.getDataValue("results")?.failed ?? []).length) {
    throw new PriceError(404, "NOTHING_TO_RETRY", "No hay suscripciones fallidas para reintentar.");
  }
  return applyChange(change, { onlyFailed: true });
};

/** Cada hora (y al arrancar): aplica los cambios que ya llegaron a su fecha. */
export const startPriceChanges = () => {
  const run = () => applyDueChanges().catch((error) => console.error("[PRECIOS] No se pudieron aplicar:", error?.message ?? error));
  setTimeout(run, 30_000).unref();
  setInterval(run, 60 * 60 * 1000).unref();
};
