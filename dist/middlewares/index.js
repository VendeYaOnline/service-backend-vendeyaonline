"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.adminLoginOnly = exports.validateOwner = exports.validateAdmin = exports.validateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const users_1 = __importDefault(require("../models/users"));
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
// Rutas compartidas con el sitio de clientes: token válido y el usuario del
// token debe ser el dueño del id (o el administrador). `getUserId` extrae el id
// de usuario de la petición (params, body o una consulta a la BD).
const validateOwner = (getUserId) => {
    const handle = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        if (!token) {
            res.status(401).json({ message: "Access denied. No token provided." });
            return;
        }
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (error) {
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
            const userId = Number(yield getUserId(req));
            const user = Number.isInteger(userId)
                ? yield users_1.default.findByPk(userId)
                : null;
            const ownerEmail = String((_b = user === null || user === void 0 ? void 0 : user.getDataValue("email")) !== null && _b !== void 0 ? _b : "")
                .trim()
                .toLowerCase();
            const tokenEmail = String((_c = payload.email) !== null && _c !== void 0 ? _c : "")
                .trim()
                .toLowerCase();
            if (!ownerEmail || ownerEmail !== tokenEmail) {
                res.status(403).json({ message: "Forbidden" });
                return;
            }
            next();
        }
        catch (error) {
            res.status(500).json({ message: "Error validating user" });
        }
    });
    return (req, res, next) => {
        void handle(req, res, next);
    };
};
exports.validateOwner = validateOwner;
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
