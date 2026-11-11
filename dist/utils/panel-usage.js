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
exports.getPanelProductCount = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Productos creados por la tienda en su panel (backend-cliente), consultados
 * servidor a servidor para la barra "Uso de productos" de "Mi cuenta" y para
 * no permitir bajar a un plan con menos productos de los que ya tiene.
 *
 * El panel ubica la tienda por el correo de la cuenta de VendeYaOnline
 * (companies.vendeya_account_email; una cuenta = una tienda).
 *
 * VENDEYA_PANEL_URL: URL del backend del panel, sin /api.
 * VENDEYA_SERVICE_KEY: la misma clave compartida que usan los complementos.
 *
 * Devuelve null si no está configurado, si la cuenta no tiene una tienda
 * vinculada o si el panel no responde a tiempo: quien llama usa entonces el
 * valor guardado en subscriptions.numberProductsCreated.
 */
const TIMEOUT_MS = 3000;
const config = () => {
    var _a, _b;
    return ({
        url: String((_a = process.env.VENDEYA_PANEL_URL) !== null && _a !== void 0 ? _a : "").replace(/\/+$/, ""),
        key: String((_b = process.env.VENDEYA_SERVICE_KEY) !== null && _b !== void 0 ? _b : ""),
    });
};
const getPanelProductCount = (email) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const { url, key } = config();
    if (!url || key.length < 32 || !email)
        return null;
    try {
        const { data } = yield axios_1.default.post(`${url}/api/service/products/usage`, { email }, { headers: { "x-service-key": key }, timeout: TIMEOUT_MS });
        const products = Number(data === null || data === void 0 ? void 0 : data.products);
        return Number.isInteger(products) && products >= 0 ? products : null;
    }
    catch (error) {
        // Sin tienda vinculada es normal (cuentas sin tienda aún): no se registra.
        if (((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.code) !== "ACCOUNT_NOT_FOUND") {
            const detail = (error === null || error === void 0 ? void 0 : error.response) ? `${error.response.status} ${(_d = (_c = error.response.data) === null || _c === void 0 ? void 0 : _c.code) !== null && _d !== void 0 ? _d : ""}` : (_e = error === null || error === void 0 ? void 0 : error.code) !== null && _e !== void 0 ? _e : "error";
            console.error(`[panel-usage] No se pudo consultar el uso de productos: ${detail}`);
        }
        return null;
    }
});
exports.getPanelProductCount = getPanelProductCount;
