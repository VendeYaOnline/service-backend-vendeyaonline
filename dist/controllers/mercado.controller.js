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
exports.webhook = exports.createSubscription = void 0;
const mercadopago_1 = require("mercadopago");
const axios_1 = __importDefault(require("axios"));
const users_1 = __importDefault(require("../models/users"));
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const utils_1 = require("../utils");
const createSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new mercadopago_1.MercadoPagoConfig({
        accessToken: process.env.ACCESS_TOKEN,
    });
    const preapproval = new mercadopago_1.PreApproval(client);
    try {
        const { plan, email, amount, user_id, quantityProducts } = req.body;
        const subscription = yield preapproval.create({
            body: {
                payer_email: "test_user_1539335675@testuser.com",
                reason: "Plan " + plan,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: amount,
                    currency_id: "COP",
                },
                back_url: "https://vendeyaonline.com/account",
                status: "pending",
                external_reference: user_id + "-" + quantityProducts,
            },
        });
        const { init_point, application_id } = subscription;
        res.status(201).json({ subscription_url: init_point, application_id });
        return;
    }
    catch (error) {
        return res.status(error.status).json({ message: error.message });
    }
});
exports.createSubscription = createSubscription;
const webhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { action, type, data } = req.body;
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
            // Paso 2: Extraer el external_reference como ID del usuario
            const resultExternalReference = paymentData.external_reference.split("-");
            const clientId = resultExternalReference[0];
            const quantityProducts = resultExternalReference[1];
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
            };
            const subscription = yield suscriptions_1.default.create(subscriptionData);
            console.log("Suscripción creada:", subscription.dataValues);
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error("Error procesando la notificación:", error);
        res.sendStatus(500);
    }
});
exports.webhook = webhook;
