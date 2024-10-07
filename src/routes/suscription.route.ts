import { Router } from "express";
import {
  createSuscription,
  createCanceledSubscriptions,
} from "../controllers/suscription.controller";

const route = Router();

route.post("/create-suscription", createSuscription);
route.post("/create-canceled_suscription", createCanceledSubscriptions);

export default route;
