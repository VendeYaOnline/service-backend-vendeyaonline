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
exports.webhook = exports.updatePaymentMethod = exports.createSubscription = void 0;
const mercadopago_1 = require("mercadopago");
const axios_1 = __importDefault(require("axios"));
const users_1 = __importDefault(require("../models/users"));
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const utils_1 = require("../utils");
const preapprovald_subscriptions_1 = __importDefault(require("../models/preapprovald_subscriptions"));
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
        res.status(201).json({ subscription_url: init_point });
        return;
    }
    catch (error) {
        return res.status(400).json({ message: error.message });
    }
});
exports.createSubscription = createSubscription;
const updatePaymentMethod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.body;
    if (!id) {
        res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
        return;
    }
    try {
        const subscription = yield suscriptions_1.default.findByPk(id);
        if (!subscription) {
            res.status(404).json({ message: "No se pudo obtener la URL de actualización de pago" });
            return;
        }
        const { dataValues } = subscription;
        if (dataValues.status !== "active" && dataValues.status !== "pause") {
            res.status(400).json({ message: "No se pudo obtener la URL de actualización de pago" });
            return;
        }
        const mpResponse = yield axios_1.default.get(`https://api.mercadopago.com/preapproval/${dataValues.subscriptionId}`, {
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
        res.status(200).json({ url: init_point });
        return;
    }
    catch (error) {
        console.error("Error al obtener URL de actualización de pago:", error);
        res.status(500).json({ message: "No se pudo obtener la URL de actualización de pago" });
        return;
    }
});
exports.updatePaymentMethod = updatePaymentMethod;
const webhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { action, type, data } = req.body;
        console.log("[WEBHOOK] Body recibido:", JSON.stringify(req.body, null, 2));
        console.log(`[WEBHOOK] type="${type}" action="${action}" data.id="${data === null || data === void 0 ? void 0 : data.id}"`);
        if (type === "subscription_authorized_payment" && action === "created") {
            // Paso 1: Consultar la API de Mercado Pago
            const paymentId = data.id;
            const mercadopagoResponse = yield axios_1.default.get(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
            const paymentData = mercadopagoResponse.data;
            const subscriptionId = paymentData.preapproval_id;
            // Paso 2: Extraer el external_reference como ID del usuario
            console.log("[WEBHOOK] paymentData:", JSON.stringify(paymentData, null, 2));
            if (!paymentData.external_reference) {
                console.error("[WEBHOOK] external_reference no disponible en el pago autorizado", paymentId);
                res.sendStatus(200);
                return;
            }
            const resultExternalReference = paymentData.external_reference.split("-");
            const clientId = resultExternalReference[0];
            const quantityProducts = resultExternalReference[1];
            console.log(`[WEBHOOK] clientId="${clientId}" quantityProducts="${quantityProducts}"`);
            // Paso 3: Validar el usuario en la base de datos
            const user = yield users_1.default.findByPk(clientId, {
                include: [suscriptions_1.default],
            });
            if (!user) {
                console.log("El cliente no existe");
                res.sendStatus(200);
                return;
            }
            const { dataValues } = user;
            // Paso 4: Verificar si ya tiene una suscripción activa
            if (dataValues.Subscriptions.length) {
                console.log("El usuario ya tiene una suscripción activa");
                res.sendStatus(200);
                return;
            }
            // Paso 5: Crear la suscripción con los datos de Mercado Pago
            const subscriptionData = {
                client: clientId,
                price: Math.round(paymentData.transaction_amount),
                quantityProducts: quantityProducts,
                type: (0, utils_1.getSubscriptionType)(paymentData.reason),
                date: (0, utils_1.formatDate)(paymentData.date_created),
                subscriptionId: subscriptionId,
            };
            console.log("[WEBHOOK] Creando suscripción:", JSON.stringify(subscriptionData, null, 2));
            yield suscriptions_1.default.create(subscriptionData);
            console.log("[WEBHOOK] Suscripción creada exitosamente en BD");
            yield preapprovald_subscriptions_1.default.destroy({
                where: { client: clientId },
            });
            // Pausar la suscripción en MP después de guardar en BD
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
            // Enviar email de confirmación (no bloquea si falla)
            try {
                yield axios_1.default.post("https://app-email-production.up.railway.app/subscription-confirmed", {
                    to: dataValues.email,
                    client: dataValues.username,
                    plan: (0, utils_1.getSubscriptionType)(paymentData.reason),
                    price: Math.round(paymentData.transaction_amount),
                    date: (0, utils_1.formatDate)(paymentData.date_created),
                }, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
            }
            catch (emailError) {
                console.error("Error al enviar email de confirmación:", emailError);
            }
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
            const client = externalReference.split("-")[0];
            yield preapprovald_subscriptions_1.default.create({ client: client });
            res.sendStatus(200);
            return;
        }
        else {
            res.sendStatus(200);
            return;
        }
    }
    catch (error) {
        console.error("[WEBHOOK] Error procesando la notificación:", (_c = (_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : error === null || error === void 0 ? void 0 : error.message) !== null && _c !== void 0 ? _c : error);
        res.sendStatus(500);
    }
});
exports.webhook = webhook;
