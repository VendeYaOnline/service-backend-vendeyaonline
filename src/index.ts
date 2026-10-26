import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routeUsers from "./routes/users.route";
import routeSuscription from "./routes/suscription.route";
import routeMercado from "./routes/mercado.route";
import routeForm from "./routes/form.route";
import routeAddons from "./routes/addons.route";
import { ensureSchema } from "./database/connect";
import { startPriceChanges } from "./utils/addon-prices";
import { corsOptions } from "./middlewares";
const app = express();
dotenv.config();

//VARS
app.set("port", process.env.PORT || 5000);

//MIDLEWARES
app.use(cors(corsOptions));
app.use(express.json());

//ROUTES
app.use("/api", routeUsers);
app.use("/api", routeSuscription);
app.use("/api", routeMercado);
app.use("/api", routeForm);
app.use("/api", routeAddons);

//SERVER
// Primero los cambios aditivos del esquema (p. ej. subscriptions.addons).
ensureSchema()
  .catch((error) => console.error("[SCHEMA] No se pudo actualizar el esquema:", error?.message ?? error))
  .finally(() => {
    app.listen(app.get("port"), () => {
      console.log("Server run in port", app.get("port"));
    });
    // Cambios de precio programados de los complementos (a la hora en punto).
    startPriceChanges();
  });
