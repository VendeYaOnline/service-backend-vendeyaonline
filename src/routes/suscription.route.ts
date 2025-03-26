import { Router } from "express";
import {
  createSuscription,
  createCanceledSubscriptions,
  getSuscription,
  getCanceledSuscription,
  deleteSuscription,
  deleteCanceledSuscription,
  getAllSuscription,
  updatedSuscription,
  getAllCancellations,
  cancellationsSuscription,
  createActiveSubscriptions,
  deletePreapprovald,
  createCanceledSubscriptionsPause,
  createActiveSubscriptionsPause,
} from "../controllers/suscription.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.get("/get-suscriptions", [validateToken, getAllSuscription]);

route.get("/get-cancellations", [validateToken, getAllCancellations]);
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
route.post("/create-active_suscription", [
  validateToken,
  createActiveSubscriptions,
]);
route.post("/create-canceled_suscription_pause", [
  validateToken,
  createCanceledSubscriptionsPause,
]);
route.post("/create-active_suscription_pause", [
  validateToken,
  createActiveSubscriptionsPause,
]);
route.put("/updated-suscription/:id", [validateToken, updatedSuscription]);
route.put("/updated-cancellations/:id", [
  validateToken,
  cancellationsSuscription,
]);

route.delete("/delete-suscription/:id", [validateToken, deleteSuscription]);
route.delete("/delete-canceled_suscription/:id", [
  validateToken,
  deleteCanceledSuscription,
]);
route.delete("/delete-preapprovald/:id", [deletePreapprovald]);

export default route;
