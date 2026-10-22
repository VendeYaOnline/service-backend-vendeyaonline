"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markMercadoPagoCancelled = exports.MP_CANCELLED = void 0;
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
/**
 * Suscripción que Mercado Pago canceló por su cuenta (p. ej. tras varios
 * cobros rechazados). Ya no se cobra y Mercado Pago no permite reanudarla: la
 * cuenta tiene que suscribirse de nuevo. La fila se conserva (con sus datos)
 * y se reutiliza cuando vuelve a suscribirse.
 *
 * Solo pasan a este estado las suscripciones vigentes ("active" o "pause"):
 * las que el cliente canceló desde su cuenta siguen su propio flujo.
 */
exports.MP_CANCELLED = "mp-cancelled";
const CURRENT_STATUSES = ["active", "pause"];
/** Marca la suscripción de ese preapproval como cancelada por Mercado Pago. Devuelve si cambió. */
const markMercadoPagoCancelled = (subscriptionId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!subscriptionId)
        return false;
    const subscription = yield suscriptions_1.default.findOne({ where: { subscriptionId } });
    if (!subscription || !CURRENT_STATUSES.includes(subscription.getDataValue("status")))
        return false;
    yield subscription.update({ status: exports.MP_CANCELLED });
    console.log(`[SUSCRIPCIONES] Mercado Pago canceló el preapproval ${subscriptionId}: suscripción ${subscription.getDataValue("id")} marcada como cancelada.`);
    return true;
});
exports.markMercadoPagoCancelled = markMercadoPagoCancelled;
