import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routeUsers from "./routes/users.route";
import routeSuscription from "./routes/suscription.route";
import routeMercado from "./routes/mercado.route";
import { syncDatabase } from "./database/connect";
const app = express();
dotenv.config();

//VARS
app.set("port", process.env.PORT || 5000);

//MIDLEWARES
app.use(express.json());
app.use(cors());

//ROUTES
app.use("/api", routeUsers);
app.use("/api", routeSuscription);
app.use("/api", routeMercado);

//SERVER
app.listen(app.get("port"), () => {
  console.log("Server run in port", app.get("port"));
});
