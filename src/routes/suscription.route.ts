import { Router } from "express";
import { createSuscription } from "../controllers/suscription.controller";

const route = Router();

route.post("/create-suscription", createSuscription);

export default route;
