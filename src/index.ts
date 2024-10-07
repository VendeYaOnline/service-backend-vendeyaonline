import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routeUsers from "./routes/users.route";
import routeSuscription from "./routes/suscription.route";
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

//SERVER
app.listen(app.get("port"), () => {
  console.log("Server run in port", app.get("port"));
});
