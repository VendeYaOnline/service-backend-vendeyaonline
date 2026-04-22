import { Router } from "express";
import { validateToken } from "../middlewares";
import { createSubscription, updatePaymentMethod, webhook } from "../controllers/mercado.controller";

const route = Router();

route.post("/generate_subscription", [validateToken, createSubscription]);
route.post("/update-payment-method", [validateToken, updatePaymentMethod]);
route.post("/subscription_notification", [webhook]);

export default route;
