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
exports.dropTables = exports.resetDatabase = exports.syncDatabase = exports.sequelize = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
const users_1 = __importDefault(require("../models/users"));
dotenv_1.default.config();
exports.sequelize = new sequelize_1.Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
});
const syncDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Sincroniza los modelos con la base de datos
        yield exports.sequelize.sync({ force: true }); // Cambia a 'true' si deseas eliminar las tablas existentes y recrearlas
        console.log("Las tablas han sido sincronizadas correctamente.");
    }
    catch (error) {
        console.error("Error al sincronizar las tablas:", error);
    }
});
exports.syncDatabase = syncDatabase;
const resetDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const models = exports.sequelize.models;
        // Vaciar todas las tablas sin eliminarlas
        for (const modelName in models) {
            if (Object.hasOwnProperty.call(models, modelName)) {
                yield models[modelName].destroy({ where: {}, truncate: true });
            }
        }
        console.log("Todas las tablas han sido vaciadas correctamente.");
    }
    catch (error) {
        console.error("Error al vaciar las tablas:", error);
    }
});
exports.resetDatabase = resetDatabase;
const dropTables = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.sequelize.sync(); // Sincroniza primero para asegurarte de que los modelos están definidos
        yield users_1.default.drop(); // Elimina la tabla de usuarios
        console.log("Las tablas han sido eliminadas.");
    }
    catch (error) {
        console.error("Error al eliminar las tablas:", error);
    }
});
exports.dropTables = dropTables;
