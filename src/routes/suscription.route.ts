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
  updatedPlan,
  getSuscriptionByUser,
} from "../controllers/suscription.controller";
import { validateAdmin, validateToken } from "../middlewares";

const route = Router();

route.get("/get-suscriptions", [validateAdmin, getAllSuscription]);
route.get("/get-suscription-user/:id", [validateToken, getSuscriptionByUser]);

route.get("/get-cancellations", [validateAdmin, getAllCancellations]);
route.get("/get-suscription/:id", [validateToken, getSuscription]);
route.get("/get-canceled_suscription/:id", [
  validateToken,
  getCanceledSuscription,
]);
route.post("/create-suscription", [validateAdmin, createSuscription]);
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
route.put("/updated-suscription/:id", [validateAdmin, updatedSuscription]);
route.put("/updated-cancellations/:id", [
  validateAdmin,
  cancellationsSuscription,
]);
route.put("/updated-plan", [validateToken, updatedPlan]);

route.delete("/delete-suscription/:id", [validateAdmin, deleteSuscription]);
route.delete("/delete-canceled_suscription/:id", [
  validateAdmin,
  deleteCanceledSuscription,
]);
route.delete("/delete-preapprovald/:id", [deletePreapprovald]);

export default route;
