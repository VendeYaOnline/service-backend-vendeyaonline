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
exports.webhook = exports.getPaymentMethod = exports.updatePaymentMethod = exports.createSubscription = void 0;
const mercadopago_1 = require("mercadopago");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const users_1 = __importDefault(require("../models/users"));
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const utils_1 = require("../utils");
const preapprovald_subscriptions_1 = __importDefault(require("../models/preapprovald_subscriptions"));
// MercadoPago devuelve el init_point con "&activation=true", pero su checkout de
// suscripciones (mp-subscriptions-checkout-fe) responde INVALID_PARAMS ("Esta
// página no existe") cuando recibe ese parámetro. Sin él, la URL carga bien.
const sanitizeInitPoint = (initPoint) => {
    if (!initPoint)
        return undefined;
    try {
        const url = new URL(initPoint);
        url.searchParams.delete("activation");
        return url.toString();
    }
    catch (_a) {
        return initPoint.replace(/[?&]activation=true/, "");
    }
};
const createSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new mercadopago_1.MercadoPagoConfig({
        accessToken: process.env.ACCESS_TOKEN,
    });
    const preapproval = new mercadopago_1.PreApproval(client);
    try {
        const { plan, email, amount, user_id, quantityProducts } = req.body;
        const subscription = yield preapproval.create({
            body: {
                payer_email: email,
                reason: "Plan " + plan,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: amount,
                    currency_id: "COP",
                },
                back_url: "https://www.vendeyaonline.com/account",
                notification_url: "https://service-backend-vendeyaonline-production.up.railway.app/api/subscription_notification",
                status: "pending",
                external_reference: user_id + "-" + quantityProducts,
            },
        });
        const { init_point, id: preapprovalId } = subscription;
        if (preapprovalId) {
            yield suscriptions_1.default.update({ subscriptionId: preapprovalId }, { where: { client: user_id } });
        }
        res.status(201).json({ subscription_url: sanitizeInitPoint(init_point) });
        return;
    }
    catch (error) {
        return res.status(400).json({ message: error.message });
    }
});
exports.createSubscription = createSubscription;
const updatePaymentMethod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { preapproval_id } = req.body;
    if (!preapproval_id) {
        res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
        return;
    }
    try {
        // Buscamos por subscriptionId (== preapproval id) para conservar el guard de estado.
        const subscription = yield suscriptions_1.default.findOne({
            where: { subscriptionId: preapproval_id },
        });
        if (!subscription) {
            res.status(404).json({ message: "No se pudo obtener la URL de actualización de pago" });
            return;
        }
        const { dataValues } = subscription;
        if (dataValues.status !== "active" && dataValues.status !== "pause") {
            res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
            return;
        }
        const mpResponse = yield axios_1.default.get(`https://api.mercadopago.com/preapproval/${preapproval_id}`, {
            headers: {
                Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        const { init_point } = mpResponse.data;
        if (!init_point) {
            res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
            return;
        }
        res.status(200).json({ url: sanitizeInitPoint(init_point) });
        return;
    }
    catch (error) {
        console.error("Error al obtener URL de actualización de pago:", error);
        res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
        return;
    }
});
exports.updatePaymentMethod = updatePaymentMethod;
// Devuelve el medio de pago vigente de la suscripción del usuario.
// Busca el pago más reciente asociado por external_reference y extrae marca,
// tipo y últimos 4 dígitos. Útil para que el cliente sepa qué tarjeta tiene
// antes de actualizarla y no repita la misma.
const getPaymentMethod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const { id } = req.params;
    if (!id || id === "undefined") {
        res.status(400).json({ message: "ID is missing" });
        return;
    }
    try {
        const user = yield users_1.default.findByPk(id, { include: [suscriptions_1.default] });
        if (!user) {
            res.status(404).json({ message: "The client does not exist" });
            return;
        }
        const { dataValues } = user;
        if (!dataValues.Subscriptions.length) {
            res.status(200).json({ paymentMethod: null });
            return;
        }
        const subscription = dataValues.Subscriptions[0].dataValues;
        const mpHeaders = {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        };
        // El external_reference del preapproval es inmutable; lo preferimos sobre
        // reconstruirlo desde quantityProducts (que cambia si el cliente actualiza el plan).
        let externalReference = `${subscription.client}-${subscription.quantityProducts}`;
        try {
            const preapprovalResponse = yield axios_1.default.get(`https://api.mercadopago.com/preapproval/${subscription.subscriptionId}`, { headers: mpHeaders });
            if ((_a = preapprovalResponse.data) === null || _a === void 0 ? void 0 : _a.external_reference) {
                externalReference = preapprovalResponse.data.external_reference;
            }
        }
        catch (preapprovalError) {
            console.error("Error al obtener el preapproval, se usa external_reference reconstruido:", (_d = (_c = (_b = preapprovalError === null || preapprovalError === void 0 ? void 0 : preapprovalError.response) === null || _b === void 0 ? void 0 : _b.data) !== null && _c !== void 0 ? _c : preapprovalError === null || preapprovalError === void 0 ? void 0 : preapprovalError.message) !== null && _d !== void 0 ? _d : preapprovalError);
        }
        const searchResponse = yield axios_1.default.get(`https://api.mercadopago.com/v1/payments/search`, {
            params: {
                external_reference: externalReference,
                sort: "date_created",
                criteria: "desc",
                limit: 1,
            },
            headers: mpHeaders,
        });
        const payment = (_f = (_e = searchResponse.data) === null || _e === void 0 ? void 0 : _e.results) === null || _f === void 0 ? void 0 : _f[0];
        if (!payment) {
            res.status(200).json({ paymentMethod: null });
            return;
        }
        res.status(200).json({
            paymentMethod: {
                brand: (_g = payment.payment_method_id) !== null && _g !== void 0 ? _g : null, // visa, master, account_money...
                type: (_h = payment.payment_type_id) !== null && _h !== void 0 ? _h : null, // credit_card, debit_card, account_money...
                lastFourDigits: (_k = (_j = payment.card) === null || _j === void 0 ? void 0 : _j.last_four_digits) !== null && _k !== void 0 ? _k : null,
            },
        });
        return;
    }
    catch (error) {
        console.error("Error al obtener el medio de pago:", (_o = (_m = (_l = error === null || error === void 0 ? void 0 : error.response) === null || _l === void 0 ? void 0 : _l.data) !== null && _m !== void 0 ? _m : error === null || error === void 0 ? void 0 : error.message) !== null && _o !== void 0 ? _o : error);
        res.status(500).json({ message: "No se pudo obtener el medio de pago" });
        return;
    }
});
exports.getPaymentMethod = getPaymentMethod;
// Valida la firma del webhook de MercadoPago (header x-signature).
// Si MP_WEBHOOK_SECRET no está configurado, no bloquea (fail-open) pero avisa.
const isValidSignature = (req) => {
    var _a, _b, _c, _d;
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[WEBHOOK] MP_WEBHOOK_SECRET no configurado; se omite la validación de firma.");
        return true;
    }
    const signature = req.headers["x-signature"];
    const requestId = req.headers["x-request-id"];
    if (!signature) {
        console.error("[WEBHOOK] Falta el header x-signature");
        return false;
    }
    const parts = signature.split(",").reduce((acc, part) => {
        const [key, value] = part.split("=");
        if (key && value)
            acc[key.trim()] = value.trim();
        return acc;
    }, {});
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) {
        console.error("[WEBHOOK] x-signature mal formado");
        return false;
    }
    const dataId = (_d = (_a = req.query["data.id"]) !== null && _a !== void 0 ? _a : (_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : "";
    // Plantilla del manifiesto según la documentación de MercadoPago.
    let manifest = "";
    if (dataId)
        manifest += `id:${String(dataId).toLowerCase()};`;
    if (requestId)
        manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;
    const hmac = crypto_1.default
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex");
    try {
        const valid = crypto_1.default.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
        if (!valid)
            console.error("[WEBHOOK] Firma inválida");
        return valid;
    }
    catch (_e) {
        console.error("[WEBHOOK] Error comparando la firma");
        return false;
    }
};
// El external_reference de las suscripciones creadas por esta app es
// "<idUsuario>-<cantidadProductos>". Suscripciones antiguas usan otro formato
// (p. ej. "<email>-Tienda online"); devolvemos null para poder ignorarlas.
const parseExternalReference = (reference) => {
    const match = /^(\d+)-(\d+)$/.exec(String(reference !== null && reference !== void 0 ? reference : ""));
    if (!match)
        return null;
    return { clientId: match[1], quantityProducts: match[2] };
};
// Crea la suscripción real en BD a partir de los datos de MercadoPago.
// Idempotente: si el usuario ya tiene una suscripción no hace nada, por lo que
// puede dispararse tanto desde "subscription_preapproval" como desde
// "subscription_authorized_payment" sin duplicar.
const activateSubscription = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { clientId, quantityProducts, price, reason, dateCreated, subscriptionId } = params;
    // Si este preapproval ya está guardado, la suscripción existe (aunque el
    // external_reference apunte a otro id de usuario, p. ej. tras restaurar la BD).
    if (subscriptionId) {
        const existing = yield suscriptions_1.default.findOne({ where: { subscriptionId } });
        if (existing) {
            console.log("[WEBHOOK] El preapproval ya está registrado, se omite", subscriptionId);
            return;
        }
    }
    const user = yield users_1.default.findByPk(clientId, { include: [suscriptions_1.default] });
    if (!user) {
        console.log("[WEBHOOK] El cliente no existe", clientId);
        return;
    }
    const { dataValues } = user;
    if (dataValues.Subscriptions.length) {
        console.log("[WEBHOOK] El usuario ya tiene una suscripción, se omite (idempotencia)");
        return;
    }
    const subscriptionData = {
        client: clientId,
        price: Math.round(price),
        quantityProducts: quantityProducts,
        type: (0, utils_1.getSubscriptionType)(reason),
        date: (0, utils_1.formatDate)(dateCreated),
        subscriptionId: subscriptionId,
    };
    console.log("[WEBHOOK] Creando suscripción:", JSON.stringify(subscriptionData, null, 2));
    yield suscriptions_1.default.create(subscriptionData);
    console.log("[WEBHOOK] Suscripción creada exitosamente en BD");
    yield preapprovald_subscriptions_1.default.destroy({ where: { client: clientId } });
    // Pausar la suscripción en MP después de guardar en BD (regla de negocio).
    if (subscriptionId) {
        try {
            yield axios_1.default.put(`https://api.mercadopago.com/preapproval/${subscriptionId}`, { status: "paused" }, {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
        }
        catch (pauseError) {
            console.error("Error al pausar suscripción en MP:", pauseError);
        }
    }
    // Enviar email de confirmación (no bloquea si falla).
    try {
        yield axios_1.default.post("https://app-email-production.up.railway.app/subscription-confirmed", {
            to: dataValues.email,
            client: dataValues.username,
            plan: (0, utils_1.getSubscriptionType)(reason),
            price: Math.round(price),
            date: (0, utils_1.formatDate)(dateCreated),
        }, {
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
    catch (emailError) {
        console.error("Error al enviar email de confirmación:", emailError);
    }
});
const webhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!isValidSignature(req)) {
            res.sendStatus(401);
            return;
        }
        const { action, type, data } = req.body;
        console.log("[WEBHOOK] Body recibido:", JSON.stringify(req.body, null, 2));
        console.log(`[WEBHOOK] type="${type}" action="${action}" data.id="${data === null || data === void 0 ? void 0 : data.id}"`);
        // Señal MÁS RÁPIDA: el preapproval pasa a "authorized" en cuanto el usuario
        // confirma la suscripción, mucho antes que el primer cobro autorizado.
        if (type === "subscription_preapproval") {
            const preapprovalId = data.id;
            const mpResponse = yield axios_1.default.get(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
            const preapproval = mpResponse.data;
            console.log("[WEBHOOK] preapproval:", JSON.stringify(preapproval, null, 2));
            if (preapproval.status !== "authorized") {
                console.log(`[WEBHOOK] preapproval ${preapprovalId} con status "${preapproval.status}", ignorando.`);
                res.sendStatus(200);
                return;
            }
            if (!preapproval.external_reference) {
                console.error("[WEBHOOK] external_reference no disponible en el preapproval", preapprovalId);
                res.sendStatus(200);
                return;
            }
            const reference = parseExternalReference(preapproval.external_reference);
            if (!reference) {
                console.log(`[WEBHOOK] external_reference con formato no reconocido "${preapproval.external_reference}", ignorando.`);
                res.sendStatus(200);
                return;
            }
            const { clientId, quantityProducts } = reference;
            console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);
            yield activateSubscription({
                clientId,
                quantityProducts,
                price: (_a = preapproval.auto_recurring) === null || _a === void 0 ? void 0 : _a.transaction_amount,
                reason: preapproval.reason,
                dateCreated: preapproval.date_created,
                subscriptionId: preapprovalId,
            });
            res.sendStatus(200);
            return;
        }
        else if (type === "subscription_authorized_payment" && action === "created") {
            // Respaldo (idempotente) del primer cobro autorizado.
            const paymentId = data.id;
            const mercadopagoResponse = yield axios_1.default.get(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
            const paymentData = mercadopagoResponse.data;
            const subscriptionId = paymentData.preapproval_id;
            console.log("[WEBHOOK] paymentData:", JSON.stringify(paymentData, null, 2));
            if (!paymentData.external_reference) {
                console.error("[WEBHOOK] external_reference no disponible en el pago autorizado", paymentId);
                res.sendStatus(200);
                return;
            }
            const reference = parseExternalReference(paymentData.external_reference);
            if (!reference) {
                console.log(`[WEBHOOK] external_reference con formato no reconocido "${paymentData.external_reference}", ignorando.`);
                res.sendStatus(200);
                return;
            }
            const { clientId, quantityProducts } = reference;
            console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);
            yield activateSubscription({
                clientId,
                quantityProducts,
                price: paymentData.transaction_amount,
                reason: paymentData.reason,
                dateCreated: paymentData.date_created,
                subscriptionId,
            });
            res.sendStatus(200);
            return;
        }
        else if (type === "payment" && action === "payment.created") {
            let mercadopagoResponse;
            try {
                mercadopagoResponse = yield axios_1.default.get(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                });
            }
            catch (paymentError) {
                console.log(`[WEBHOOK] Pago ${data.id} no encontrado o rechazado, ignorando.`);
                res.sendStatus(200);
                return;
            }
            const paymentStatus = mercadopagoResponse.data.status;
            if (paymentStatus !== "approved") {
                console.log(`[WEBHOOK] Pago ${data.id} con status "${paymentStatus}", ignorando.`);
                res.sendStatus(200);
                return;
            }
            const externalReference = mercadopagoResponse.data.external_reference;
            if (!externalReference) {
                console.log(`[WEBHOOK] Pago ${data.id} sin external_reference, ignorando.`);
                res.sendStatus(200);
                return;
            }
            const reference = parseExternalReference(externalReference);
            if (!reference) {
                console.log(`[WEBHOOK] Pago ${data.id} con external_reference no reconocido "${externalReference}", ignorando.`);
                res.sendStatus(200);
                return;
            }
            // Solo sirve para el primer cobro (usuario aún sin suscripción en BD).
            // Los cobros mensuales de quien ya tiene suscripción no deben crear filas.
            const user = yield users_1.default.findByPk(reference.clientId, { include: [suscriptions_1.default] });
            const { dataValues: userData } = (user !== null && user !== void 0 ? user : { dataValues: null });
            if (!userData || userData.Subscriptions.length) {
                console.log(`[WEBHOOK] Pago ${data.id}: usuario inexistente o con suscripción, ignorando.`);
                res.sendStatus(200);
                return;
            }
            yield preapprovald_subscriptions_1.default.create({ client: reference.clientId });
            res.sendStatus(200);
            return;
        }
        else {
            res.sendStatus(200);
            return;
        }
    }
    catch (error) {
        console.error("[WEBHOOK] Error procesando la notificación:", (_d = (_c = (_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data) !== null && _c !== void 0 ? _c : error === null || error === void 0 ? void 0 : error.message) !== null && _d !== void 0 ? _d : error);
        res.sendStatus(500);
    }
});
exports.webhook = webhook;
