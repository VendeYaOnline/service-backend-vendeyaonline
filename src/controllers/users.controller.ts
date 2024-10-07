import { Request, Response } from "express";
import User from "../models/users";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserI } from "../interfaces";
import { loginSchema, userSchema } from "../schemas/userSchema";

export const createUser = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const { error } = userSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    } else {
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
    }
  } catch (error: any) {
    if (error.errors[0].message === "email must be unique") {
      res.status(500).json({
        error: `The user already exists`,
      });
    } else {
      res.status(500).json({
        error: `Error creating user - ${error.errors[0].message}`,
      });
    }
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { error } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    } else {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      } else {
        const isMatch = await bcrypt.compare(
          password,
          user.dataValues.password
        );
        if (!isMatch) {
          res.status(401).json({ error: "Incorrect password or email" });
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
    }
  } catch (error: any) {
    res.status(500).json({ error: "Login error" });
  }
};
