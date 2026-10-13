import { Router } from "express";
import { validateService } from "../middlewares";
import { accountStatus, activateAddon, cancelAddon, quoteAddon } from "../controllers/addons.controller";

const route = Router();

// Solo servidor a servidor (backend del panel de tiendas), con x-service-key.
route.post("/service/addons/quote", [validateService, quoteAddon]);
route.post("/service/addons/activate", [validateService, activateAddon]);
route.post("/service/addons/cancel", [validateService, cancelAddon]);
// Estado de la suscripción (cancelada, cobros fallidos) para el panel de tiendas.
route.post("/service/account/status", [validateService, accountStatus]);

export default route;
