import { Router } from "express";
import {
  createSuscription,
  createCanceledSubscriptions,
} from "../controllers/suscription.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.post("/create-suscription", [validateToken, createSuscription]);
route.post("/create-canceled_suscription", [
  validateToken,
  createCanceledSubscriptions,
]);

export default route;
