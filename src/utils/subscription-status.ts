import Subscription from "../models/suscriptions";

/**
 * Suscripción que Mercado Pago canceló por su cuenta (p. ej. tras varios
 * cobros rechazados). Ya no se cobra y Mercado Pago no permite reanudarla: la
 * cuenta tiene que suscribirse de nuevo. La fila se conserva (con sus datos)
 * y se reutiliza cuando vuelve a suscribirse.
 *
 * Solo pasan a este estado las suscripciones vigentes ("active" o "pause"):
 * las que el cliente canceló desde su cuenta siguen su propio flujo.
 */
export const MP_CANCELLED = "mp-cancelled";

const CURRENT_STATUSES = ["active", "pause"];

/** Marca la suscripción de ese preapproval como cancelada por Mercado Pago. Devuelve si cambió. */
export const markMercadoPagoCancelled = async (subscriptionId: string) => {
  if (!subscriptionId) return false;
  const subscription: any = await Subscription.findOne({ where: { subscriptionId } });
  if (!subscription || !CURRENT_STATUSES.includes(subscription.getDataValue("status"))) return false;
  await subscription.update({ status: MP_CANCELLED });
  console.log(`[SUSCRIPCIONES] Mercado Pago canceló el preapproval ${subscriptionId}: suscripción ${subscription.getDataValue("id")} marcada como cancelada.`);
  return true;
};
