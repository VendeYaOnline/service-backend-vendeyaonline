import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routeUsers from "./routes/users.route"
import { syncDatabase } from "./database/connect";
const app = express();
dotenv.config();

//VARS
app.set("port", process.env.PORT || 5000);

//MIDLEWARES
app.use(express.json());
app.use(cors());


//ROUTES
app.use("/api",routeUsers)

//SERVER
app.listen(app.get("port"), () => {
  console.log("Server ruj in port", app.get("port"));
});
