import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const validateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access denied. No token provided." });
    return;
  }

  try {
    const secretKey = process.env.JWT_SECRET!;
    const valid = jwt.verify(token, secretKey);
    console.log("valid",valid)
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token." });
    return;
  }
};
