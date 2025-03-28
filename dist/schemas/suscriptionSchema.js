"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suscriptionSchemaUpdated = exports.suscriptionSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.suscriptionSchema = joi_1.default.object({
    price: joi_1.default.number().required(),
    quantityProducts: joi_1.default.number().required(),
    type: joi_1.default.string()
        .valid("Emprendedor", "Crecimiento", "Corporativo")
        .required(),
    date: joi_1.default.string().required(),
    date_limit: joi_1.default.string().optional(),
    subscriptionId: joi_1.default.string(),
    status: joi_1.default.string().optional(),
    client: joi_1.default.number().required(),
});
exports.suscriptionSchemaUpdated = joi_1.default.object({
    price: joi_1.default.number().optional(),
    quantityProducts: joi_1.default.number().optional(),
    status: joi_1.default.string().optional(),
    type: joi_1.default.string()
        .valid("Emprendedor", "Crecimiento", "Corporativo")
        .optional(),
    date: joi_1.default.string().optional(),
    client: joi_1.default.number().optional(),
});
