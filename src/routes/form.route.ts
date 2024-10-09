import { Router } from "express";
import { registerForm, deleteForm } from "../controllers/form.controller";

const route = Router();

route.post("/register-form", registerForm);
route.delete("/delete-form/:id", deleteForm);

export default route;
