import { Request, Response } from "express";
import Form from "../models/form";
import { userSchema } from "../schemas/userSchema";

export const registerForm = async (req: Request, res: Response) => {
  const data = req.body;
  const { error } = userSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    await Form.create(data);
    res.status(201).json({ message: "Registered message" });
    return;
  }
};
