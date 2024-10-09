import { Request, Response } from "express";
import Form from "../models/form";
import { formSchema } from "../schemas/userSchema";

export const registerForm = async (req: Request, res: Response) => {
  const data = req.body;
  const { error } = formSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    await Form.create(data);
    res.status(201).json({ message: "Registered message" });
    return;
  }
};

export const deleteForm = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "ID required" });
    return;
  } else {
    await Form.destroy({ where: { id } });
    res.status(204).json({ message: "Deleted message" });
    return;
  }
};
