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
    jwt.verify(token, secretKey);
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
    return;
  }
};

export const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://vendeyaonline.com",
    "https://dashboard-vendeyaonline.vercel.app",
    "https://www.vendeyaonline.com",
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Si necesitas permitir cookies
};
