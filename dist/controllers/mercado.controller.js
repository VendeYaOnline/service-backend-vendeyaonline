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
exports.createSubscription = void 0;
const mercadopago_1 = require("mercadopago");
const createSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new mercadopago_1.MercadoPagoConfig({
        accessToken: process.env.ACCESS_TOKEN,
    });
    const preapproval = new mercadopago_1.PreApproval(client);
    try {
        const { plan, email } = req.body;
        const subscription = yield preapproval.create({
            body: {
                payer_email: email,
                reason: plan === "web" ? "Página web" : "Tienda online",
                external_reference: email + "-" + (plan === "web" ? "Página web" : "Tienda online"),
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: plan === "web" ? 30000 : 60000,
                    currency_id: "COP",
                },
                back_url: "https://vendeyaonline.com/checkout?id=4EmuiW2J4wTmYRr",
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
