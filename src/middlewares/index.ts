import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/users";

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

const isAdminEmail = (email: unknown) => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return (
    !!adminEmail && String(email ?? "").trim().toLowerCase() === adminEmail
  );
};

// Rutas exclusivas del dashboard: token válido y correo igual a ADMIN_EMAIL.
// Sin ADMIN_EMAIL configurado nadie pasa.
export const validateAdmin = (
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
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof payload === "string" || !isAdminEmail(payload.email)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
    return;
  }
};

// Rutas compartidas con el sitio de clientes: token válido y el usuario del
// token debe ser el dueño del id (o el administrador). `getUserId` extrae el id
// de usuario de la petición (params, body o una consulta a la BD).
export const validateOwner = (
  getUserId: (req: Request) => unknown | Promise<unknown>
) => {
  const handle = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Access denied. No token provided." });
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      res.status(400).json({ message: "Invalid token" });
      return;
    }
    if (typeof payload === "string") {
      res.status(400).json({ message: "Invalid token" });
      return;
    }

    try {
      if (isAdminEmail(payload.email)) {
        next();
        return;
      }

      const userId = Number(await getUserId(req));
      const user = Number.isInteger(userId)
        ? await User.findByPk(userId)
        : null;
      const ownerEmail = String(user?.getDataValue("email") ?? "")
        .trim()
        .toLowerCase();
      const tokenEmail = String(payload.email ?? "")
        .trim()
        .toLowerCase();

      if (!ownerEmail || ownerEmail !== tokenEmail) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Error validating user" });
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    void handle(req, res, next);
  };
};

// Login del dashboard: solo permite iniciar sesión al administrador. Responde
// igual que un login fallido para no revelar qué correos existen.
export const adminLoginOnly = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isAdminEmail(req.body?.email)) {
    res.status(401).json({ error: "Incorrect password or email" });
    return;
  }
  next();
};

export const corsOptions = {
  origin: [
    "https://dashboard-vendeyaonline.vercel.app",
    "https://www.vendeyaonline.com",
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Si necesitas permitir cookies
};
