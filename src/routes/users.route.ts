import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserByEmail,
  loginUser,
  updatedPassword,
  updatedPasswordEmail,
  updatedUser,
  deleteUser,
  verifyToken,
  changePassword,
} from "../controllers/users.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.get("/verify-token", [validateToken, verifyToken]);
route.get("/get-users", [validateToken, getAllUsers]);
route.post("/change-password/:email", [changePassword]);
route.get("/get-user_byEmail/:email", getUserByEmail);
route.post("/create-user", createUser);
route.post("/login-user", loginUser);
route.put("/update-password", [validateToken, updatedPassword]);
route.put("/update-password_email", updatedPasswordEmail);
route.put("/update-user/:id", [validateToken, updatedUser]);
route.delete("/delete-user/:id", [validateToken, deleteUser]);

export default route;
