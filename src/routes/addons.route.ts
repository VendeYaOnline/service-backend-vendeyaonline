import { Router } from "express";
import { validateService } from "../middlewares";
import { activateAddon, cancelAddon, quoteAddon } from "../controllers/addons.controller";

const route = Router();

// Solo servidor a servidor (backend del panel de tiendas), con x-service-key.
route.post("/service/addons/quote", [validateService, quoteAddon]);
route.post("/service/addons/activate", [validateService, activateAddon]);
route.post("/service/addons/cancel", [validateService, cancelAddon]);

export default route;
