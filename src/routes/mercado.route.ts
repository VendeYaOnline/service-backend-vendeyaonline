import { Router } from "express";
import { validateOwner } from "../middlewares";
import Subscription from "../models/suscriptions";
import { createSubscription, updatePaymentMethod, webhook, getPaymentMethod } from "../controllers/mercado.controller";

const route = Router();

route.post("/generate_subscription", [
  validateOwner((req) => req.body?.user_id),
  createSubscription,
]);
// El dueño se obtiene de la suscripción a la que pertenece el preapproval.
route.post("/update-payment-method", [
  validateOwner(async (req) => {
    const preapprovalId = req.body?.preapproval_id;
    if (!preapprovalId) return undefined;
    const subscription = await Subscription.findOne({
      where: { subscriptionId: String(preapprovalId) },
    });
    return subscription?.getDataValue("client");
  }),
  updatePaymentMethod,
]);
route.get("/payment-method/:id", [
  validateOwner((req) => req.params.id),
  getPaymentMethod,
]);
route.post("/subscription_notification", [webhook]);

export default route;
