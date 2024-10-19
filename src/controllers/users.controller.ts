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

      const { password, ...rest } = dataValues;
      res.status(201).json({ user: rest, token });
      return;
    }
  } catch (error: any) {
    if (error.errors[0].message === "email must be unique") {
      res.status(500).json({
        error: `The user already exists`,
      });
      return;
    } else {
      res.status(500).json({
        error: `Error creating user - ${error.errors[0].message}`,
      });
      return;
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
        res.status(404).json({ error: "Incorrect password or email" });
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

        const { password: password2, ...rest } = dataValues;
        res.status(200).json({ user: rest, token });
        return;
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: "Login error" });
    return;
  }
};

export const updatedPassword = async (req: Request, res: Response) => {
  try {
    const { id, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update(
      { password: hashedPassword },
      {
        where: { id },
      }
    );
    res.status(200).json({ message: "Updated password" });
    return;
  } catch (error) {
    res.status(500).json({ error: "Error updating password" });
    return;
  }
};

export const updatedPasswordEmail = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update(
      { password: hashedPassword },
      {
        where: { email },
      }
    );
    res.status(200).json({ message: "Updated password" });
    return;
  } catch (error) {
    res.status(500).json({ error: "Error updating password" });
    return;
  }
};

export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ where: { email } });
    const { dataValues } = user as { dataValues: UserI };
    const { username } = dataValues;
    res.status(200).json({ user: username });
    return;
  } catch (error) {
    res.status(404).json({ error: "User not found" });
    return;
  }
};

export const updatedUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await User.update(
      { ...data },
      {
        where: { id },
      }
    );
    const user = await User.findOne({ where: { email: data.email } });
    const { dataValues } = user as { dataValues: UserI };
    const { password, ...rest } = dataValues;
    res.status(201).json({ ...rest });
    return;
  } catch (error) {
    res.status(404).json({ error: "User not found" });
    return;
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await User.destroy({
      where: { id },
    });
    if (response === 0) {
      return res.status(404).json({ message: "User not found" });
    } else {
      return res.status(204).json({ message: "User successfully deleted" });
    }
  } catch (error) {
    res.status(404).json({ message: "User not found" });
    return;
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.findAll();
    res.status(200).json(users);
    return;
  } catch (error) {
    res.status(404).json({ message: "User not found" });
    return;
  }
};
