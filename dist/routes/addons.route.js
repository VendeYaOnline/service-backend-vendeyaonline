"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middlewares_1 = require("../middlewares");
const addons_controller_1 = require("../controllers/addons.controller");
const route = (0, express_1.Router)();
// Solo servidor a servidor (backend del panel de tiendas), con x-service-key.
route.post("/service/addons/quote", [middlewares_1.validateService, addons_controller_1.quoteAddon]);
route.post("/service/addons/activate", [middlewares_1.validateService, addons_controller_1.activateAddon]);
route.post("/service/addons/cancel", [middlewares_1.validateService, addons_controller_1.cancelAddon]);
// Estado de la suscripción (cancelada, cobros fallidos) para el panel de tiendas.
route.post("/service/account/status", [middlewares_1.validateService, addons_controller_1.accountStatus]);
exports.default = route;
