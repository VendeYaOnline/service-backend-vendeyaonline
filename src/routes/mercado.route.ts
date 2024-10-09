import { Router } from "express";
import { validateToken } from "../middlewares";
import { createSubscription } from "../controllers/mercado.controller";

const route = Router();

route.post("/generate_subscription", [validateToken, createSubscription]);

export default route;
