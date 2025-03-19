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
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhook = exports.createSubscription = void 0;
const mercadopago_1 = require("mercadopago");
const createSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new mercadopago_1.MercadoPagoConfig({
        accessToken: process.env.ACCESS_TOKEN,
    });
    const preapproval = new mercadopago_1.PreApproval(client);
    try {
        const { plan, email, amount } = req.body;
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
const webhook = (req, res) => {
    try {
        console.log("Notificación recibida:", req.body);
        // Verifica si la notificación es de tipo suscripción
        if (req.body.action === "subscription_create" ||
            req.body.action === "subscription_update") {
            const subscriptionId = req.body.data.id;
            console.log("ID de la suscripción:", subscriptionId);
            // Aquí puedes consultar la API de Mercado Pago si necesitas más detalles
        }
        res.sendStatus(200); // Responde a Mercado Pago para confirmar recepción
    }
    catch (error) {
        console.error("Error procesando la notificación:", error);
        res.sendStatus(500);
    }
};
exports.webhook = webhook;
