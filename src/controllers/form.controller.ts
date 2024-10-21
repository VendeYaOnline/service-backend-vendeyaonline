import { Request, Response } from "express";
import Form from "../models/form";
import { formSchema, formSchemaUpdated } from "../schemas/userSchema";

export const getAllForms = async (_req: Request, res: Response) => {
  try {
    const response = await Form.findAll();
    if (response.length) {
      res.status(200).json({ forms: response });
      return;
    } else {
      res.status(200).json({ forms: [] });
      return;
    }
  } catch (error) {
    res.status(500).json({ message: error });
    return;
  }
};

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

export const updatedForm = async (req: Request, res: Response) => {
  const data = req.body;
  const { id } = req.params;
  const { error } = formSchemaUpdated.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  } else {
    await Form.update(data, { where: { id } });
    res.status(201).json({ message: "Form updated" });
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
