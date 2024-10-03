"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
//VARS
app.set("port", process.env.PORT || 5000);
//MIDLEWARES
app.use(express_1.default.json());
app.use((0, cors_1.default)());
//SERVER
app.listen(app.get("port"), () => {
    console.log("Server run port in", app.get("port"));
});
