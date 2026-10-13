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
exports.corsOptions = exports.adminLoginOnly = exports.validateService = exports.validateOwner = exports.validateAdmin = exports.validateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
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
// Rutas servidor a servidor (backend del panel de tiendas): header x-service-key
// igual a VENDEYA_SERVICE_KEY. Nunca se llaman desde el navegador. Sin la
// variable configurada nadie pasa.
const validateService = (req, res, next) => {
    var _a, _b;
    const expected = (_a = process.env.VENDEYA_SERVICE_KEY) !== null && _a !== void 0 ? _a : "";
    const received = String((_b = req.header("x-service-key")) !== null && _b !== void 0 ? _b : "");
    if (expected.length < 32) {
        res.status(503).json({ code: "SERVICE_NOT_CONFIGURED", message: "Service key not configured" });
        return;
    }
    const a = crypto_1.default.createHash("sha256").update(received).digest();
    const b = crypto_1.default.createHash("sha256").update(expected).digest();
    if (!crypto_1.default.timingSafeEqual(a, b)) {
        res.status(401).json({ code: "SERVICE_UNAUTHORIZED", message: "Unauthorized" });
        return;
    }
    next();
};
exports.validateService = validateService;
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
