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
exports.accountStatus = exports.cancelAddon = exports.activateAddon = exports.quoteAddon = void 0;
const sequelize_1 = require("sequelize");
const connect_1 = require("../database/connect");
const users_1 = __importDefault(require("../models/users"));
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const addons_1 = require("../utils/addons");
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
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
const parseBody = (body) => {
    const email = typeof (body === null || body === void 0 ? void 0 : body.email) === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !email.includes("@")) {
        throw new AddonError(400, "EMAIL_INVALID", "Correo de la cuenta inválido.");
    }
    if (!(0, addons_1.isAddonKey)(body === null || body === void 0 ? void 0 : body.addon)) {
        throw new AddonError(400, "ADDON_INVALID", "Complemento desconocido.");
    }
    return { email, addon: body.addon };
};
/** Usuario y su suscripción (bloqueada para escribir si va en una transacción). */
const findAccount = (email, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield users_1.default.findOne({
        where: (0, sequelize_1.where)((0, sequelize_1.fn)("lower", (0, sequelize_1.col)("email")), email),
        transaction,
    });
    if (!user)
        return { user: null, subscription: null };
    const subscription = yield suscriptions_1.default.findOne(Object.assign({ where: { client: user.getDataValue("id") }, order: [["id", "DESC"]], transaction }, (transaction ? { lock: transaction.LOCK.UPDATE } : {})));
    return { user, subscription };
});
const summary = (subscription, addon, nextPaymentDate = null) => {
    const price = Number(subscription.getDataValue("price"));
    const addons = (0, addons_1.normalizeAddons)(subscription.getDataValue("addons"));
    return {
        subscription: {
            type: subscription.getDataValue("type"),
            status: subscription.getDataValue("status"),
            plan_price: price,
            addons,
            addons_total: (0, addons_1.addonsTotal)(addons),
            total: (0, addons_1.subscriptionTotal)(price, addons),
            next_payment_date: nextPaymentDate,
        },
        addon: Object.assign(Object.assign({ key: addon }, addons_1.ADDONS[addon]), { active: addons.includes(addon) }),
    };
};
const sendError = (res, error, context) => {
    var _a, _b, _c;
    if (error instanceof AddonError) {
        return res.status(error.status).json({ code: error.code, message: error.message });
    }
    // Errores de Mercado Pago: sin datos sensibles, solo el mensaje.
    const mpMessage = (_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message;
    console.error(`[ADDONS] ${context}:`, (_c = mpMessage !== null && mpMessage !== void 0 ? mpMessage : error === null || error === void 0 ? void 0 : error.message) !== null && _c !== void 0 ? _c : error);
    return res.status(502).json({
        code: "MERCADOPAGO_ERROR",
        message: "No se pudo actualizar la suscripción en Mercado Pago. Intenta de nuevo en unos minutos.",
    });
};
/** POST /api/service/addons/quote — `eligible` dice si puede activarlo solo. */
const quoteAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { email, addon } = parseBody(req.body);
        const { user, subscription } = yield findAccount(email);
        if (!user)
            return res.status(200).json({ eligible: false, reason: "ACCOUNT_NOT_FOUND" });
        if (!subscription)
            return res.status(200).json({ eligible: false, reason: "NO_SUBSCRIPTION" });
        // La fecha del próximo cobro es informativa: si Mercado Pago no responde, no bloquea.
        let nextPaymentDate = null;
        try {
            nextPaymentDate = (_b = (_a = (yield (0, addons_1.getPreapproval)(subscription.getDataValue("subscriptionId")))) === null || _a === void 0 ? void 0 : _a.next_payment_date) !== null && _b !== void 0 ? _b : null;
        }
        catch (_c) {
            nextPaymentDate = null;
        }
        const editable = EDITABLE_STATUSES.includes(subscription.getDataValue("status"));
        return res.status(200).json(Object.assign({ eligible: editable, reason: editable ? null : "SUBSCRIPTION_NOT_ACTIVE" }, summary(subscription, addon, nextPaymentDate)));
    }
    catch (error) {
        return sendError(res, error, "quote");
    }
});
exports.quoteAddon = quoteAddon;
/**
 * Suma o quita el complemento. Con la fila de la suscripción bloqueada, así dos
 * pedidos a la vez no cobran doble ni dejan el monto desfasado.
 */
const changeAddon = (mode) => (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, addon } = parseBody(req.body);
        const result = yield connect_1.sequelize.transaction((transaction) => __awaiter(void 0, void 0, void 0, function* () {
            const { user, subscription } = yield findAccount(email, transaction);
            if (!user)
                throw new AddonError(404, "ACCOUNT_NOT_FOUND", "No existe una cuenta de VendeYaOnline con ese correo.");
            if (!subscription)
                throw new AddonError(409, "NO_SUBSCRIPTION", "La cuenta no tiene una suscripción.");
            const status = subscription.getDataValue("status");
            if (!EDITABLE_STATUSES.includes(status)) {
                throw new AddonError(409, "SUBSCRIPTION_NOT_ACTIVE", "La suscripción no está activa.");
            }
            const current = (0, addons_1.normalizeAddons)(subscription.getDataValue("addons"));
            const has = current.includes(addon);
            // Idempotente: repetir el pedido no vuelve a cambiar el cobro.
            if ((mode === "activate" && has) || (mode === "cancel" && !has)) {
                return Object.assign({ changed: false }, summary(subscription, addon));
            }
            const next = mode === "activate" ? [...current, addon] : current.filter((key) => key !== addon);
            const price = Number(subscription.getDataValue("price"));
            const subscriptionId = subscription.getDataValue("subscriptionId");
            const type = subscription.getDataValue("type");
            const finalStatus = status === "pause" ? "paused" : "authorized";
            // Primero Mercado Pago; la BD solo cambia si eso funcionó.
            yield (0, addons_1.setPreapprovalAmount)(subscriptionId, type, (0, addons_1.subscriptionTotal)(price, next), finalStatus);
            try {
                yield subscription.update({ addons: next }, { transaction });
            }
            catch (dbError) {
                // Si no se pudo guardar, se devuelve el monto anterior en Mercado Pago.
                yield (0, addons_1.setPreapprovalAmount)(subscriptionId, type, (0, addons_1.subscriptionTotal)(price, current), finalStatus).catch(() => { });
                throw dbError;
            }
            console.log(`[ADDONS] ${mode} ${addon} para la suscripción ${subscription.getDataValue("id")}`);
            return Object.assign({ changed: true }, summary(subscription, addon));
        }));
        return res.status(200).json(result);
    }
    catch (error) {
        return sendError(res, error, mode);
    }
});
/** POST /api/service/addons/activate */
exports.activateAddon = changeAddon("activate");
/** POST /api/service/addons/cancel */
exports.cancelAddon = changeAddon("cancel");
/**
 * POST /api/service/account/status — estado de la suscripción de una cuenta,
 * para que el panel de tiendas bloquee vistas de pago si se canceló y avise si
 * Mercado Pago no logra cobrar. `preapproval_status` y `payment_issue` son null
 * si Mercado Pago no respondió (estado desconocido: el panel no toca nada).
 */
const accountStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const email = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email || email.length > 254 || !email.includes("@")) {
            throw new AddonError(400, "EMAIL_INVALID", "Correo de la cuenta inválido.");
        }
        const { user, subscription } = yield findAccount(email);
        if (!user)
            return res.status(200).json({ account: false, subscription: null });
        if (!subscription)
            return res.status(200).json({ account: true, subscription: null });
        let preapproval = null;
        try {
            preapproval = yield (0, addons_1.getPreapproval)(subscription.getDataValue("subscriptionId"));
        }
        catch (_f) {
            preapproval = null;
        }
        // Semáforo de cobros de Mercado Pago: green = al día; yellow/red = cobros fallidos.
        const semaphore = (_c = (_b = preapproval === null || preapproval === void 0 ? void 0 : preapproval.summarized) === null || _b === void 0 ? void 0 : _b.semaphore) !== null && _c !== void 0 ? _c : null;
        return res.status(200).json({
            account: true,
            subscription: {
                type: subscription.getDataValue("type"),
                status: subscription.getDataValue("status"),
                addons: (0, addons_1.normalizeAddons)(subscription.getDataValue("addons")),
                preapproval_status: (_d = preapproval === null || preapproval === void 0 ? void 0 : preapproval.status) !== null && _d !== void 0 ? _d : null,
                payment_issue: preapproval ? semaphore === "yellow" || semaphore === "red" : null,
                next_payment_date: (_e = preapproval === null || preapproval === void 0 ? void 0 : preapproval.next_payment_date) !== null && _e !== void 0 ? _e : null,
            },
        });
    }
    catch (error) {
        return sendError(res, error, "status");
    }
});
exports.accountStatus = accountStatus;
