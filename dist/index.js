"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const users_route_1 = __importDefault(require("./routes/users.route"));
const suscription_route_1 = __importDefault(require("./routes/suscription.route"));
const mercado_route_1 = __importDefault(require("./routes/mercado.route"));
const form_route_1 = __importDefault(require("./routes/form.route"));
const middlewares_1 = require("./middlewares");
const app = (0, express_1.default)();
dotenv_1.default.config();
//VARS
app.set("port", process.env.PORT || 5000);
//MIDLEWARES
app.use(express_1.default.json());
app.use((0, cors_1.default)(middlewares_1.corsOptions));
//ROUTES
app.use("/api", users_route_1.default);
app.use("/api", suscription_route_1.default);
app.use("/api", mercado_route_1.default);
app.use("/api", form_route_1.default);
//SERVER
app.listen(app.get("port"), () => {
    console.log("Server run in port", app.get("port"));
});
