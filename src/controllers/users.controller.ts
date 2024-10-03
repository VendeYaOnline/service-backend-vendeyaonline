import { Request, Response } from "express";
import User from "../models/users";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserI } from "../interfaces";

export const createUser = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    data.password = hashedPassword;
    const user = await User.create(data);
    const { dataValues } = user as { dataValues: UserI };
    const token = jwt.sign(
      { email: dataValues.email },
      process.env.JWT_SECRET!,
      {
        expiresIn: "10h",
      }
    );

    res.status(201).json({ username: dataValues.username, token });
  } catch (error: any) {
    res.status(500).json({
      error: `Error al crear el usuario - ${error.errors[0].message}`,
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    } else {
      const isMatch = await bcrypt.compare(password, user.dataValues.password);
      if (!isMatch) {
        res.status(401).json({ error: "Contraseña incorrecta" });
        return;
      }

      const { dataValues } = user as { dataValues: UserI };
      const token = jwt.sign(
        { id: dataValues.id, email: dataValues.email },
        process.env.JWT_SECRET!,
        {
          expiresIn: "10h",
        }
      );

      res.status(200).json({ username: dataValues.username, token });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
};
