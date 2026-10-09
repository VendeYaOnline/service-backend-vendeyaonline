"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.adminLoginOnly = exports.validateAdmin = exports.validateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const validateToken = (req, res, next) => {
    var _a;
    const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    if (!token) {
        res.status(401).json({ message: "Access denied. No token provided." });
        return;
    }
    try {
        const secretKey = process.env.JWT_SECRET;
        jsonwebtoken_1.default.verify(token, secretKey);
        next();
    }
    catch (error) {
        res.status(400).json({ message: "Invalid token" });
        return;
    }
};
exports.validateToken = validateToken;
const isAdminEmail = (email) => {
    var _a;
    const adminEmail = (_a = process.env.ADMIN_EMAIL) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    return (!!adminEmail && String(email !== null && email !== void 0 ? email : "").trim().toLowerCase() === adminEmail);
};
// Rutas exclusivas del dashboard: token válido y correo igual a ADMIN_EMAIL.
// Sin ADMIN_EMAIL configurado nadie pasa.
const validateAdmin = (req, res, next) => {
    var _a;
    const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    if (!token) {
        res.status(401).json({ message: "Access denied. No token provided." });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (typeof payload === "string" || !isAdminEmail(payload.email)) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        next();
    }
    catch (error) {
        res.status(400).json({ message: "Invalid token" });
        return;
    }
};
exports.validateAdmin = validateAdmin;
// Login del dashboard: solo permite iniciar sesión al administrador. Responde
// igual que un login fallido para no revelar qué correos existen.
const adminLoginOnly = (req, res, next) => {
    var _a;
    if (!isAdminEmail((_a = req.body) === null || _a === void 0 ? void 0 : _a.email)) {
        res.status(401).json({ error: "Incorrect password or email" });
        return;
    }
    next();
};
exports.adminLoginOnly = adminLoginOnly;
exports.corsOptions = {
    origin: [
        "https://dashboard-vendeyaonline.vercel.app",
        "https://www.vendeyaonline.com",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Si necesitas permitir cookies
};
