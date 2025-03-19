"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middlewares_1 = require("../middlewares");
const mercado_controller_1 = require("../controllers/mercado.controller");
const route = (0, express_1.Router)();
route.post("/generate_subscription", [middlewares_1.validateToken, mercado_controller_1.createSubscription]);
route.post("/subscription_notification", [mercado_controller_1.webhook]);
exports.default = route;
