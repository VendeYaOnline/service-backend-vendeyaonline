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
exports.resetDatabase = exports.ensureSchema = exports.sequelize = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
dotenv_1.default.config();
exports.sequelize = new sequelize_1.Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
});
/**
 * Cambios aditivos del esquema, al arrancar. Nunca borra ni modifica datos:
 * solo agrega lo que falta (columnas nuevas con valor por defecto).
 */
const ensureSchema = () => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.sequelize.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addons JSON NOT NULL DEFAULT '[]'::json`);
    // Cambios de precio de los complementos (utils/addon-prices.ts).
    yield exports.sequelize.query(`CREATE TABLE IF NOT EXISTS addon_price_changes (
    id SERIAL PRIMARY KEY,
    addon VARCHAR(40) NOT NULL,
    old_price INTEGER NOT NULL,
    new_price INTEGER NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    results JSON,
    created_by VARCHAR(254),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
  )`);
});
exports.ensureSchema = ensureSchema;
const resetDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.sequelize.sync({ force: true }); // Esto eliminará y volverá a crear todas las tablas
        console.log("Todas las tablas han sido eliminadas y recreadas correctamente.");
    }
    catch (error) {
        console.error("Error al resetear la base de datos:", error);
    }
});
exports.resetDatabase = resetDatabase;
