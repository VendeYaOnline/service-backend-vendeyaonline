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
exports.setPreapprovalAmount = exports.getPreapproval = exports.MP_API_URL = exports.subscriptionTotal = exports.addonsTotal = exports.newAddonEntry = exports.normalizeAddons = exports.addonEntries = exports.isAddonKey = exports.ADDON_KEYS = exports.ADDONS = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Complementos que se suman a la mensualidad del plan (vistas de pago del
 * panel de la tienda). El precio lo define este servidor, nunca el cliente.
 * `subscriptions.price` sigue siendo el precio del plan; lo que cobra Mercado
 * Pago es plan + complementos (ver `subscriptionTotal`).
 *
 * `subscriptions.addons` guarda cada complemento con el precio con el que se
 * activó: { key, price }. Así, si el precio cambia, quien ya lo tenía sigue
 * pagando lo mismo (es lo que Mercado Pago le cobra). Las entradas antiguas
 * son solo la clave ("marketing") y valen LEGACY_PRICES.
 */
exports.ADDONS = {
    marketing: { label: "Marketing", price: 20000 },
};
/** Precio de las entradas antiguas (solo la clave), el vigente cuando se activaron. */
const LEGACY_PRICES = { marketing: 10000 };
exports.ADDON_KEYS = Object.keys(exports.ADDONS);
const isAddonKey = (value) => typeof value === "string" && exports.ADDON_KEYS.includes(value);
exports.isAddonKey = isAddonKey;
/** Lo guardado en la columna → complementos conocidos con su precio, sin repetir. */
const addonEntries = (raw) => {
    if (!Array.isArray(raw))
        return [];
    const entries = [];
    for (const item of raw) {
        const key = typeof item === "string" ? item : item === null || item === void 0 ? void 0 : item.key;
        if (!(0, exports.isAddonKey)(key) || entries.some((entry) => entry.key === key))
            continue;
        const price = typeof item === "object" && Number.isFinite(Number(item === null || item === void 0 ? void 0 : item.price)) ? Math.round(Number(item.price)) : LEGACY_PRICES[key];
        entries.push({ key, price });
    }
    return entries;
};
exports.addonEntries = addonEntries;
/** Claves de los complementos activos. */
const normalizeAddons = (raw) => (0, exports.addonEntries)(raw).map((entry) => entry.key);
exports.normalizeAddons = normalizeAddons;
/** Entrada nueva con el precio vigente. */
const newAddonEntry = (key) => ({ key, price: exports.ADDONS[key].price });
exports.newAddonEntry = newAddonEntry;
/** `raw` = lo guardado en la columna (no solo las claves). */
const addonsTotal = (raw) => (0, exports.addonEntries)(raw).reduce((sum, entry) => sum + entry.price, 0);
exports.addonsTotal = addonsTotal;
/** Lo que se cobra cada mes: plan + complementos (`raw` = lo guardado en la columna). */
const subscriptionTotal = (price, raw) => Math.round(price) + (0, exports.addonsTotal)(raw);
exports.subscriptionTotal = subscriptionTotal;
/**
 * API de Mercado Pago. MERCADOPAGO_API_URL solo se usa para pruebas locales
 * (un Mercado Pago simulado); en producción no se define.
 */
exports.MP_API_URL = (process.env.MERCADOPAGO_API_URL || "https://api.mercadopago.com").replace(/\/+$/, "");
const mpHeaders = () => ({
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    "Content-Type": "application/json",
});
const getPreapproval = (subscriptionId) => __awaiter(void 0, void 0, void 0, function* () { return (yield axios_1.default.get(`${exports.MP_API_URL}/preapproval/${subscriptionId}`, { headers: mpHeaders() })).data; });
exports.getPreapproval = getPreapproval;
/**
 * Cambia el monto mensual del preapproval en Mercado Pago. MP solo permite
 * cambiarlo en estado "authorized", así que se autoriza temporalmente y se
 * deja en `finalStatus` aunque falle el cambio de monto.
 */
const setPreapprovalAmount = (subscriptionId, type, amount, finalStatus) => __awaiter(void 0, void 0, void 0, function* () {
    const preapprovalUrl = `${exports.MP_API_URL}/preapproval/${subscriptionId}`;
    const headers = mpHeaders();
    const preapproval = yield (0, exports.getPreapproval)(subscriptionId);
    if (preapproval.status !== "authorized") {
        yield axios_1.default.put(preapprovalUrl, { status: "authorized" }, { headers });
    }
    try {
        yield axios_1.default.put(preapprovalUrl, {
            reason: "Plan " + type,
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: amount,
                currency_id: "COP",
            },
        }, { headers });
    }
    finally {
        if (finalStatus === "paused") {
            yield axios_1.default.put(preapprovalUrl, { status: "paused" }, { headers });
        }
    }
});
exports.setPreapprovalAmount = setPreapprovalAmount;
