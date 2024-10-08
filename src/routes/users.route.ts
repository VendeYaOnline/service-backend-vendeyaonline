import { Router } from "express";
import {
  createUser,
  getUserByEmail,
  loginUser,
  updatedPassword,
  updatedPasswordEmail,
  updatedUser,
} from "../controllers/users.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.get("/get-user_byEmail/:email", getUserByEmail);
route.post("/create-user", createUser);
route.post("/login-user", loginUser);
route.put("/update-password", [validateToken, updatedPassword]);
route.put("/update-password_email", updatedPasswordEmail);
route.put("/update-user/:id", [validateToken, updatedUser]);

export default route;
