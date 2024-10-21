import { Router } from "express";
import {
  registerForm,
  deleteForm,
  getAllForms,
  updatedForm,
} from "../controllers/form.controller";
import { validateToken } from "../middlewares";

const route = Router();

route.get("/get-forms", [validateToken, getAllForms]);
route.post("/register-form", registerForm);
route.put("/updated-form/:id", [validateToken, updatedForm]);
route.delete("/delete-form/:id", [validateToken, deleteForm]);

export default route;
