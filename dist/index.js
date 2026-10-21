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
const addons_route_1 = __importDefault(require("./routes/addons.route"));
const connect_1 = require("./database/connect");
const addon_prices_1 = require("./utils/addon-prices");
const middlewares_1 = require("./middlewares");
const app = (0, express_1.default)();
dotenv_1.default.config();
//VARS
app.set("port", process.env.PORT || 5000);
//MIDLEWARES
app.use((0, cors_1.default)(middlewares_1.corsOptions));
app.use(express_1.default.json());
//ROUTES
app.use("/api", users_route_1.default);
app.use("/api", suscription_route_1.default);
app.use("/api", mercado_route_1.default);
app.use("/api", form_route_1.default);
app.use("/api", addons_route_1.default);
//SERVER
// Primero los cambios aditivos del esquema (p. ej. subscriptions.addons).
(0, connect_1.ensureSchema)()
    .catch((error) => { var _a; return console.error("[SCHEMA] No se pudo actualizar el esquema:", (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error); })
    .finally(() => {
    app.listen(app.get("port"), () => {
        console.log("Server run in port", app.get("port"));
    });
    // Cambios de precio programados de los complementos (cada hora).
    (0, addon_prices_1.startPriceChanges)();
});
