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
const express_1 = require("express");
const middlewares_1 = require("../middlewares");
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const mercado_controller_1 = require("../controllers/mercado.controller");
const route = (0, express_1.Router)();
route.post("/generate_subscription", [
    (0, middlewares_1.validateOwner)((req) => { var _a; return (_a = req.body) === null || _a === void 0 ? void 0 : _a.user_id; }),
    mercado_controller_1.createSubscription,
]);
// El dueño se obtiene de la suscripción a la que pertenece el preapproval.
route.post("/update-payment-method", [
    (0, middlewares_1.validateOwner)((req) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const preapprovalId = (_a = req.body) === null || _a === void 0 ? void 0 : _a.preapproval_id;
        if (!preapprovalId)
            return undefined;
        const subscription = yield suscriptions_1.default.findOne({
            where: { subscriptionId: String(preapprovalId) },
        });
        return subscription === null || subscription === void 0 ? void 0 : subscription.getDataValue("client");
    })),
    mercado_controller_1.updatePaymentMethod,
]);
route.get("/payment-method/:id", [
    (0, middlewares_1.validateOwner)((req) => req.params.id),
    mercado_controller_1.getPaymentMethod,
]);
route.post("/subscription_notification", [mercado_controller_1.webhook]);
exports.default = route;
