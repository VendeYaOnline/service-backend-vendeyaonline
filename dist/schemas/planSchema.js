"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planSchemaUpdated = void 0;
const joi_1 = __importDefault(require("joi"));
exports.planSchemaUpdated = joi_1.default.object({
    price: joi_1.default.number().required(),
    client: joi_1.default.number().required(),
    quantityProducts: joi_1.default.number().optional(),
    type: joi_1.default.string()
        .valid("Emprendedor", "Crecimiento", "Corporativo")
        .optional(),
});
