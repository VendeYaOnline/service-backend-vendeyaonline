import { Router } from "express";
import { registerForm } from "../controllers/form.controller";

const route = Router();

route.post("/register-form", registerForm);

export default route;
