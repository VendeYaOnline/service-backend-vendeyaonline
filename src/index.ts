import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routeUsers from "./routes/users.route";
import routeSuscription from "./routes/suscription.route";
import routeMercado from "./routes/mercado.route";
import routeForm from "./routes/form.route";
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

//SERVER
app.listen(app.get("port"), () => {
  console.log("Server run in port", app.get("port"));
});
