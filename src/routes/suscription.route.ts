import { Router } from "express";
import {
  createSuscription,
  createCanceledSubscriptions,
  getSuscription,
  getCanceledSuscription,
} from "../controllers/suscription.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.get("/get-suscription/:id", [validateToken, getSuscription]);
route.get("/get-canceled_suscription/:id", [
  validateToken,
  getCanceledSuscription,
]);
route.post("/create-suscription", [validateToken, createSuscription]);
route.post("/create-canceled_suscription", [
  validateToken,
  createCanceledSubscriptions,
]);

export default route;
