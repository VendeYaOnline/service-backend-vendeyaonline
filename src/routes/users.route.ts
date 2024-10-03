import { Router } from "express";
import { createUser,loginUser } from "../controllers/users.controller";

const route = Router();

route.post("/create-user", createUser);
route.post("/login-user", loginUser);

export default route;
