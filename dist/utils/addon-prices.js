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
exports.startPriceChanges = exports.retryPriceChange = exports.cancelPriceChange = exports.schedulePriceChange = exports.applyDueChanges = exports.applyChange = exports.pricingSummary = exports.scheduledChange = exports.newAddonEntry = exports.getAddonPrice = exports.PriceError = exports.AddonPriceChange = exports.MIN_NOTICE_DAYS = void 0;
const sequelize_1 = require("sequelize");
const connect_1 = require("../database/connect");
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const users_1 = __importDefault(require("../models/users"));
const addons_1 = require("./addons");
/**
 * Precio de los complementos (p. ej. Marketing), controlado por el
 * superadministrador desde el panel de tiendas.
 *
 * - El precio vigente es el del último cambio aplicado (o ADDONS si no hay).
 * - Subir el precio se PROGRAMA con al menos MIN_NOTICE_DAYS de aviso: la
 *   tienda ve el aviso y recibe un correo (los manda el backend de tiendas) y
 *   puede cancelar antes. En la fecha, applyDueChanges actualiza el monto de
 *   cada suscripción en Mercado Pago y el precio guardado en su complemento.
 * - Bajar el precio se aplica de inmediato (beneficia a la tienda).
 * - Suscripciones pausadas: no se tocan (quedan en "paused" del resultado);
 *   el superadmin las revisa a mano. Las que ya cancelaron el complemento
 *   (cancel_at) tampoco: no se les vuelve a cobrar.
 * - Si Mercado Pago falla con una, conserva su precio anterior: nunca se cobra
 *   de más por error. Se puede reintentar.
 */
exports.MIN_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
exports.AddonPriceChange = connect_1.sequelize.define("AddonPriceChange", {
    id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    addon: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    old_price: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    new_price: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    effective_at: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    /** scheduled → applying → applied | canceled */
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "scheduled" },
    /** { updated: [...], failed: [...], paused: [...] } */
    results: { type: sequelize_1.DataTypes.JSON, allowNull: true },
    created_by: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    applied_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, { tableName: "addon_price_changes", timestamps: false });
class PriceError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
exports.PriceError = PriceError;
/** Precio vigente: el del último cambio aplicado, o el de ADDONS. */
const getAddonPrice = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const last = yield exports.AddonPriceChange.findOne({
        where: { addon: key, status: "applied" },
        order: [["applied_at", "DESC"], ["id", "DESC"]],
    });
    return last ? Number(last.getDataValue("new_price")) : addons_1.ADDONS[key].price;
});
exports.getAddonPrice = getAddonPrice;
/** Entrada nueva con el precio vigente. */
const newAddonEntry = (key) => __awaiter(void 0, void 0, void 0, function* () { return ({ key, price: yield (0, exports.getAddonPrice)(key), cancel_at: null }); });
exports.newAddonEntry = newAddonEntry;
/** Cambio programado (aún no aplicado), o null. */
const scheduledChange = (key) => __awaiter(void 0, void 0, void 0, function* () { return exports.AddonPriceChange.findOne({ where: { addon: key, status: "scheduled" }, order: [["id", "DESC"]] }); });
exports.scheduledChange = scheduledChange;
const changeJson = (change) => {
    var _a;
    return change
        ? {
            id: change.getDataValue("id"),
            old_price: change.getDataValue("old_price"),
            new_price: change.getDataValue("new_price"),
            effective_at: change.getDataValue("effective_at"),
            status: change.getDataValue("status"),
            created_at: change.getDataValue("created_at"),
            applied_at: change.getDataValue("applied_at"),
            results: (_a = change.getDataValue("results")) !== null && _a !== void 0 ? _a : null,
        }
        : null;
};
/** Suscripciones con el complemento activo y cobrándose (sin cancelación), con el correo de su cuenta. */
const billedSubscriptions = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const subscriptions = yield suscriptions_1.default.findAll({ include: [{ model: users_1.default, attributes: ["email"] }] });
    return subscriptions.filter((subscription) => (0, addons_1.addonEntries)(subscription.getDataValue("addons")).some((entry) => entry.key === key && !entry.cancel_at));
});
/** Resumen para el superadmin: precio vigente, quién lo paga y a cuánto, y el cambio programado o el último. */
const pricingSummary = (key) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const [price, scheduled, last, subscriptions] = yield Promise.all([
        (0, exports.getAddonPrice)(key),
        (0, exports.scheduledChange)(key),
        exports.AddonPriceChange.findOne({ where: { addon: key, status: { [sequelize_1.Op.in]: ["applied", "applying"] } }, order: [["id", "DESC"]] }),
        billedSubscriptions(key),
    ]);
    const byPrice = new Map();
    for (const subscription of subscriptions) {
        const entry = (0, addons_1.addonEntries)(subscription.getDataValue("addons")).find((item) => item.key === key);
        byPrice.set(entry.price, ((_a = byPrice.get(entry.price)) !== null && _a !== void 0 ? _a : 0) + 1);
    }
    return {
        addon: key,
        label: addons_1.ADDONS[key].label,
        price,
        min_notice_days: exports.MIN_NOTICE_DAYS,
        subscribers: {
            total: subscriptions.length,
            by_price: [...byPrice.entries()].map(([value, count]) => ({ price: value, count })).sort((a, b) => a.price - b.price),
            // Cuentas que lo pagan (el panel de tiendas les avisa de una subida).
            emails: subscriptions.map((subscription) => { var _a, _b; return (_b = (_a = subscription.User) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toLowerCase(); }).filter(Boolean),
        },
        scheduled: changeJson(scheduled),
        last: changeJson(last),
    };
});
exports.pricingSummary = pricingSummary;
/** Aplica un cambio a una suscripción (con su fila bloqueada). */
const applyToSubscription = (subscriptionId, key, newPrice) => __awaiter(void 0, void 0, void 0, function* () {
    return connect_1.sequelize.transaction((transaction) => __awaiter(void 0, void 0, void 0, function* () {
        const subscription = yield suscriptions_1.default.findByPk(subscriptionId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!subscription)
            return "gone";
        const entries = (0, addons_1.addonEntries)(subscription.getDataValue("addons"));
        const entry = entries.find((item) => item.key === key);
        if (!entry || entry.cancel_at)
            return "canceled";
        if (entry.price === newPrice)
            return "updated";
        if (subscription.getDataValue("status") !== "active")
            return "paused";
        const next = entries.map((item) => (item.key === key ? Object.assign(Object.assign({}, item), { price: newPrice }) : item));
        // Primero Mercado Pago; la base solo cambia si eso funcionó.
        yield (0, addons_1.setPreapprovalAmount)(subscription.getDataValue("subscriptionId"), subscription.getDataValue("type"), (0, addons_1.subscriptionTotal)(Number(subscription.getDataValue("price")), next), "authorized");
        yield subscription.update({ addons: next }, { transaction });
        return "updated";
    }));
});
let running = false;
/**
 * Aplica un cambio a todas las suscripciones que pagan el complemento.
 * `onlyFailed`: reintenta solo las que fallaron la vez anterior.
 */
const applyChange = (change_1, ...args_1) => __awaiter(void 0, [change_1, ...args_1], void 0, function* (change, { onlyFailed = false } = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const key = change.getDataValue("addon");
    const newPrice = Number(change.getDataValue("new_price"));
    const previous = (_a = change.getDataValue("results")) !== null && _a !== void 0 ? _a : { updated: [], failed: [], paused: [] };
    yield change.update({ status: "applying" });
    const targets = onlyFailed
        ? previous.failed.map((item) => item.subscription_id)
        : (yield billedSubscriptions(key)).map((subscription) => subscription.getDataValue("id"));
    const emails = new Map();
    for (const subscription of (yield suscriptions_1.default.findAll({ where: { id: targets }, include: [{ model: users_1.default, attributes: ["email"] }] }))) {
        emails.set(subscription.getDataValue("id"), (_c = (_b = subscription.User) === null || _b === void 0 ? void 0 : _b.email) !== null && _c !== void 0 ? _c : null);
    }
    const results = onlyFailed ? Object.assign(Object.assign({}, previous), { failed: [] }) : { updated: [], failed: [], paused: [] };
    for (const id of targets) {
        const item = { subscription_id: id, email: (_d = emails.get(id)) !== null && _d !== void 0 ? _d : null };
        try {
            const outcome = yield applyToSubscription(id, key, newPrice);
            if (outcome === "updated")
                results.updated.push(item);
            else if (outcome === "paused")
                results.paused.push(item);
        }
        catch (error) {
            // Sin datos sensibles: solo el mensaje de Mercado Pago.
            results.failed.push(Object.assign(Object.assign({}, item), { error: String((_h = (_g = (_f = (_e = error === null || error === void 0 ? void 0 : error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.message) !== null && _g !== void 0 ? _g : error === null || error === void 0 ? void 0 : error.message) !== null && _h !== void 0 ? _h : error).slice(0, 200) }));
        }
    }
    yield change.update({ status: "applied", results, applied_at: (_j = change.getDataValue("applied_at")) !== null && _j !== void 0 ? _j : new Date() });
    console.log(`[PRECIOS] ${key}: ${results.updated.length} actualizadas, ${results.failed.length} fallidas, ${results.paused.length} pausadas`);
    return changeJson(change);
});
exports.applyChange = applyChange;
/** Aplica los cambios cuya fecha ya llegó (cada hora y al arrancar). */
const applyDueChanges = () => __awaiter(void 0, void 0, void 0, function* () {
    if (running)
        return;
    running = true;
    try {
        // "applying" = se cortó a mitad (p. ej. reinicio): se retoma; las ya actualizadas se saltan.
        const due = yield exports.AddonPriceChange.findAll({ where: { status: { [sequelize_1.Op.in]: ["scheduled", "applying"] }, effective_at: { [sequelize_1.Op.lte]: new Date() } } });
        for (const change of due)
            yield (0, exports.applyChange)(change);
    }
    finally {
        running = false;
    }
});
exports.applyDueChanges = applyDueChanges;
/**
 * Programa un cambio de precio. Subir: fecha con al menos MIN_NOTICE_DAYS de
 * aviso. Bajar: se aplica ya (effective_at = ahora). Reemplaza el programado.
 */
const schedulePriceChange = (_a) => __awaiter(void 0, [_a], void 0, function* ({ key, price, effectiveAt, createdBy }) {
    if (!Number.isInteger(price) || price < 1000 || price > 10000000) {
        throw new PriceError(400, "PRICE_INVALID", "El precio debe ser un número entero de pesos, entre 1.000 y 10.000.000.");
    }
    const current = yield (0, exports.getAddonPrice)(key);
    if (price === current)
        throw new PriceError(400, "PRICE_UNCHANGED", "Ese ya es el precio actual.");
    let when = new Date();
    if (price > current) {
        when = new Date(effectiveAt !== null && effectiveAt !== void 0 ? effectiveAt : "");
        if (Number.isNaN(when.getTime()))
            throw new PriceError(400, "DATE_INVALID", "Elige la fecha desde la que aplica el precio nuevo.");
        // Un minuto de margen por la hora del navegador.
        if (when.getTime() < Date.now() + exports.MIN_NOTICE_DAYS * DAY_MS - 60000) {
            throw new PriceError(400, "NOTICE_TOO_SHORT", `Para subir el precio hay que avisar con al menos ${exports.MIN_NOTICE_DAYS} días de anticipación.`);
        }
    }
    const previous = yield (0, exports.scheduledChange)(key);
    if (previous)
        yield previous.update({ status: "canceled" });
    const change = yield exports.AddonPriceChange.create({
        addon: key,
        old_price: current,
        new_price: price,
        effective_at: when,
        status: "scheduled",
        created_by: createdBy !== null && createdBy !== void 0 ? createdBy : null,
    });
    // Bajar el precio: de una vez.
    if (price < current)
        yield (0, exports.applyChange)(change);
    return { change: changeJson(change), immediate: price < current, increase: price > current };
});
exports.schedulePriceChange = schedulePriceChange;
/** Cancela el cambio programado (si no se ha aplicado). */
const cancelPriceChange = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const change = yield (0, exports.scheduledChange)(key);
    if (!change)
        throw new PriceError(404, "NO_SCHEDULED_CHANGE", "No hay un cambio de precio programado.");
    yield change.update({ status: "canceled" });
    return changeJson(change);
});
exports.cancelPriceChange = cancelPriceChange;
/** Reintenta las suscripciones que fallaron en el último cambio aplicado. */
const retryPriceChange = (key) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const change = yield exports.AddonPriceChange.findOne({ where: { addon: key, status: "applied" }, order: [["id", "DESC"]] });
    if (!change || !((_b = (_a = change.getDataValue("results")) === null || _a === void 0 ? void 0 : _a.failed) !== null && _b !== void 0 ? _b : []).length) {
        throw new PriceError(404, "NOTHING_TO_RETRY", "No hay suscripciones fallidas para reintentar.");
    }
    return (0, exports.applyChange)(change, { onlyFailed: true });
});
exports.retryPriceChange = retryPriceChange;
/** Cada hora (y al arrancar): aplica los cambios que ya llegaron a su fecha. */
const startPriceChanges = () => {
    const run = () => (0, exports.applyDueChanges)().catch((error) => { var _a; return console.error("[PRECIOS] No se pudieron aplicar:", (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error); });
    setTimeout(run, 30000).unref();
    setInterval(run, 60 * 60 * 1000).unref();
};
exports.startPriceChanges = startPriceChanges;
