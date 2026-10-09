import { Router } from "express";
import {
  registerForm,
  deleteForm,
  getAllForms,
  updatedForm,
} from "../controllers/form.controller";
import { validateAdmin } from "../middlewares";

const route = Router();

route.get("/get-forms", [validateAdmin, getAllForms]);
route.post("/register-form", registerForm);
route.put("/updated-form/:id", [validateAdmin, updatedForm]);
route.delete("/delete-form/:id", [validateAdmin, deleteForm]);

export default route;
