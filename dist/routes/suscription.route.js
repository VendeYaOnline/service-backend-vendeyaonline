"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const suscription_controller_1 = require("../controllers/suscription.controller");
const middlewares_1 = require("../middlewares");
const route = (0, express_1.Router)();
route.get("/get-suscriptions", [middlewares_1.validateToken, suscription_controller_1.getAllSuscription]);
route.get("/get-suscription-user/:id", [middlewares_1.validateToken, suscription_controller_1.getSuscriptionByUser]);
route.get("/get-cancellations", [middlewares_1.validateToken, suscription_controller_1.getAllCancellations]);
route.get("/get-suscription/:id", [middlewares_1.validateToken, suscription_controller_1.getSuscription]);
route.get("/get-canceled_suscription/:id", [
    middlewares_1.validateToken,
    suscription_controller_1.getCanceledSuscription,
]);
route.post("/create-suscription", [middlewares_1.validateToken, suscription_controller_1.createSuscription]);
route.post("/create-canceled_suscription", [
    middlewares_1.validateToken,
    suscription_controller_1.createCanceledSubscriptions,
]);
route.post("/create-active_suscription", [
    middlewares_1.validateToken,
    suscription_controller_1.createActiveSubscriptions,
]);
route.post("/create-canceled_suscription_pause", [
    middlewares_1.validateToken,
    suscription_controller_1.createCanceledSubscriptionsPause,
]);
route.post("/create-active_suscription_pause", [
    middlewares_1.validateToken,
    suscription_controller_1.createActiveSubscriptionsPause,
]);
route.put("/updated-suscription/:id", [middlewares_1.validateToken, suscription_controller_1.updatedSuscription]);
route.put("/updated-cancellations/:id", [
    middlewares_1.validateToken,
    suscription_controller_1.cancellationsSuscription,
]);
route.put("/updated-plan", [middlewares_1.validateToken, suscription_controller_1.updatedPlan]);
route.delete("/delete-suscription/:id", [middlewares_1.validateToken, suscription_controller_1.deleteSuscription]);
route.delete("/delete-canceled_suscription/:id", [
    middlewares_1.validateToken,
    suscription_controller_1.deleteCanceledSuscription,
]);
route.delete("/delete-preapprovald/:id", [suscription_controller_1.deletePreapprovald]);
exports.default = route;
