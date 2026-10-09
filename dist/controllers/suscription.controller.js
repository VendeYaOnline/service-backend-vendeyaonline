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
exports.deletePreapprovald = exports.deleteCanceledSuscription = exports.deleteSuscription = exports.getCanceledSuscription = exports.getSuscription = exports.createActiveSubscriptionsPause = exports.createCanceledSubscriptionsPause = exports.createActiveSubscriptions = exports.createCanceledSubscriptions = exports.cancellationsSuscription = exports.updatedPlan = exports.updatedSuscription = exports.createSuscription = exports.getAllCancellations = exports.getSuscriptionByUser = exports.getAllSuscription = void 0;
const suscriptionSchema_1 = require("../schemas/suscriptionSchema");
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const users_1 = __importDefault(require("../models/users"));
const canceled_subscriptions_1 = __importDefault(require("../models/canceled_subscriptions"));
const preapprovald_subscriptions_1 = __importDefault(require("../models/preapprovald_subscriptions"));
const planSchema_1 = require("../schemas/planSchema");
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getAllSuscription = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const subscription = yield suscriptions_1.default.findAll();
        if (subscription.length) {
            res.status(200).json({ subscription });
            return;
        }
        else {
            res.status(200).json({ subscription: [] });
            return;
        }
    }
    catch (error) {
        res.status(500).json({
            message: "Error subscription",
        });
        return;
    }
});
exports.getAllSuscription = getAllSuscription;
const getSuscriptionByUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const user = yield users_1.default.findOne({
            where: { id },
            include: [suscriptions_1.default, canceled_subscriptions_1.default],
        });
        const { dataValues } = user;
        if (dataValues.Subscriptions.length ||
            dataValues.CanceledSubscriptions.length) {
            res.status(200).json({
                subscription: true,
            });
            return;
        }
        else {
            res.status(200).json({
                subscription: false,
            });
            return;
        }
    }
    catch (error) {
        res.status(500).json({
            message: "Error subscription",
        });
        return;
    }
});
exports.getSuscriptionByUser = getSuscriptionByUser;
const getAllCancellations = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const subscription = yield canceled_subscriptions_1.default.findAll();
        if (subscription.length) {
            res.status(200).json({ subscription });
            return;
        }
        else {
            res.status(200).json({ subscription: [] });
            return;
        }
    }
    catch (error) {
        res.status(500).json({
            message: "Error subscription",
        });
        return;
    }
});
exports.getAllCancellations = getAllCancellations;
const createSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { error } = suscriptionSchema_1.suscriptionSchema.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const user = yield users_1.default.findByPk(data.client, {
                include: [suscriptions_1.default, canceled_subscriptions_1.default],
            });
            if (!user) {
                res.status(404).json({
                    message: "The client does not exist",
                });
                return;
            }
            else {
                const { dataValues } = user;
                yield removeCanceledSuscription(dataValues);
                if (dataValues.Subscriptions.length) {
                    res.status(409).json({
                        message: "The user already has an active subscription",
                    });
                    return;
                }
                else {
                    const subscription = yield suscriptions_1.default.create(data);
                    const { dataValues } = subscription;
                    res.status(201).json({
                        message: `Subscription created successfully ${dataValues.type}`,
                    });
                }
            }
        }
        catch (error) {
            res.status(500).json({
                message: "Error creating user",
            });
        }
    }
});
exports.createSuscription = createSuscription;
// Cambia el monto mensual del preapproval en Mercado Pago. MP solo permite
// cambiarlo en estado "authorized", así que se autoriza temporalmente y se
// deja en `finalStatus` aunque falle el cambio de monto.
const setPreapprovalAmount = (subscriptionId, type, price, finalStatus) => __awaiter(void 0, void 0, void 0, function* () {
    const preapprovalUrl = `https://api.mercadopago.com/preapproval/${subscriptionId}`;
    const headers = {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "Content-Type": "application/json",
    };
    const { data: preapproval } = yield axios_1.default.get(preapprovalUrl, { headers });
    if (preapproval.status !== "authorized") {
        yield axios_1.default.put(preapprovalUrl, { status: "authorized" }, { headers });
    }
    try {
        yield axios_1.default.put(preapprovalUrl, {
            reason: "Plan " + type,
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: price,
                currency_id: "COP",
            },
        }, { headers });
    }
    finally {
        if (finalStatus === "paused") {
            yield axios_1.default.put(preapprovalUrl, { status: "paused" }, { headers });
        }
    }
});
const updatedSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { error } = suscriptionSchema_1.suscriptionSchemaUpdated.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const { id } = req.params;
            const headers = {
                Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            };
            const current = yield suscriptions_1.default.findByPk(id);
            if (!current) {
                res.status(404).json({ message: "Subscription not found" });
                return;
            }
            const { dataValues: stored } = current;
            const preapprovalUrl = `https://api.mercadopago.com/preapproval/${stored.subscriptionId}`;
            const finalStatus = data.status === "active" ? "authorized" : "paused";
            const priceChanged = data.price !== undefined && Math.round(data.price) !== stored.price;
            if (priceChanged && !(data.price > 0)) {
                res.status(400).json({ error: "Invalid price" });
                return;
            }
            // Primero Mercado Pago; la BD solo se actualiza si este paso funciona.
            if (priceChanged) {
                yield setPreapprovalAmount(stored.subscriptionId, (_a = data.type) !== null && _a !== void 0 ? _a : stored.type, Math.round(data.price), finalStatus);
            }
            else {
                yield axios_1.default.put(preapprovalUrl, { status: finalStatus }, { headers });
            }
            yield suscriptions_1.default.update(data, { where: { id } });
            res.status(200).json({ message: "Updated Subscription" });
            return;
        }
        catch (error) {
            res.status(500).json({ error: "Error updating" });
            return;
        }
    }
});
exports.updatedSuscription = updatedSuscription;
const FIXED_PLANS = {
    Emprendedor: { products: 50, price: 50000 },
    Crecimiento: { products: 100, price: 80000 },
};
// Precio oficial de un plan; null si type/quantityProducts no corresponden a un plan válido.
const getPlanPrice = (type, quantityProducts) => {
    const fixed = FIXED_PLANS[type];
    if (fixed)
        return fixed.products === quantityProducts ? fixed.price : null;
    if (type === "Corporativo") {
        const valid = quantityProducts >= 150 &&
            quantityProducts <= 1000 &&
            (quantityProducts - 150) % 50 === 0;
        return valid ? 130000 + (quantityProducts - 150) * 1000 : null;
    }
    return null;
};
const updatedPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { error } = planSchema_1.planSchemaUpdated.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    try {
        const data = req.body;
        const user = yield users_1.default.findByPk(data.client, { include: suscriptions_1.default });
        if (!user) {
            return res.status(404).json({ message: "The client does not exist" });
        }
        const { dataValues } = user;
        // El cliente solo puede cambiar su propio plan.
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        const payload = token ? jsonwebtoken_1.default.decode(token) : null;
        if (!payload ||
            typeof payload === "string" ||
            payload.email !== dataValues.email) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const subscription = (_b = dataValues.Subscriptions[0]) === null || _b === void 0 ? void 0 : _b.dataValues;
        if (!subscription) {
            return res.status(404).json({ message: "No subscription found" });
        }
        const { id, numberProductsCreated, status, subscriptionId } = subscription;
        if (status !== "active" && status !== "pause") {
            return res
                .status(400)
                .json({ message: "It is not possible to update the plan" });
        }
        // El precio lo define el servidor, no el cliente.
        const price = getPlanPrice(data.type, data.quantityProducts);
        if (price === null || price !== data.price) {
            return res.status(400).json({ message: "Invalid plan or price" });
        }
        if (numberProductsCreated > data.quantityProducts) {
            return res.status(400).json({ message: "Error updating plan" });
        }
        const preapprovalUrl = `https://api.mercadopago.com/preapproval/${subscriptionId}`;
        const headers = {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        };
        const amountBody = {
            reason: "Plan " + data.type,
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: price,
                currency_id: "COP",
            },
        };
        // Primero Mercado Pago; la BD solo se actualiza si este paso funciona.
        if (status === "pause") {
            // Mercado Pago solo permite cambiar el monto en estado authorized.
            yield axios_1.default.put(preapprovalUrl, { status: "authorized" }, { headers });
            try {
                yield axios_1.default.put(preapprovalUrl, amountBody, { headers });
            }
            finally {
                // Se vuelve a pausar aunque falle el cambio de monto.
                yield axios_1.default.put(preapprovalUrl, { status: "paused" }, { headers });
            }
        }
        else {
            yield axios_1.default.put(preapprovalUrl, amountBody, { headers });
        }
        yield suscriptions_1.default.update({ type: data.type, price, quantityProducts: data.quantityProducts }, { where: { id } });
        return res.status(200).json({ message: "Updated Subscription" });
    }
    catch (error) {
        return res.status(500).json({ error: "Error updating" });
    }
});
exports.updatedPlan = updatedPlan;
const cancellationsSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { error } = suscriptionSchema_1.suscriptionSchemaUpdated.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const { id } = req.params;
            yield canceled_subscriptions_1.default.update(data, {
                where: { id },
            });
            res.status(200).json({ message: "Updated Subscription" });
            return;
        }
        catch (error) {
            res.status(500).json({ error: "Error updating" });
            return;
        }
    }
});
exports.cancellationsSuscription = cancellationsSuscription;
const createCanceledSubscriptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { error } = suscriptionSchema_1.suscriptionSchema.validate(req.body);
    if (error) {
        console.log("sass", error);
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const user = yield users_1.default.findByPk(data.client, { include: suscriptions_1.default });
            if (!user) {
                res.status(404).json({
                    message: "The client does not exist",
                });
                return;
            }
            else {
                const { dataValues } = user;
                if (dataValues.Subscriptions.length) {
                    yield suscriptions_1.default.destroy({
                        where: { id: dataValues.Subscriptions[0].dataValues.id },
                    });
                    const canceledSubscription = yield canceled_subscriptions_1.default.create(data);
                    const { dataValues: dataSubscription } = canceledSubscription;
                    res.status(201).json({
                        message: `Subscription created successfully ${dataSubscription.type}`,
                    });
                    return;
                }
                else {
                    res.status(409).json({
                        message: "The user does not have a subscription",
                    });
                    return;
                }
            }
        }
        catch (error) {
            console.log("Error al canelar", error);
            res.status(500).json({
                message: "Error creating user",
            });
        }
    }
});
exports.createCanceledSubscriptions = createCanceledSubscriptions;
const createActiveSubscriptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { error } = suscriptionSchema_1.suscriptionSchema.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const user = yield users_1.default.findByPk(data.client, {
                include: canceled_subscriptions_1.default,
            });
            if (!user) {
                res.status(404).json({
                    message: "The client does not exist",
                });
                return;
            }
            else {
                const { dataValues } = user;
                if (dataValues.CanceledSubscriptions.length) {
                    yield canceled_subscriptions_1.default.destroy({
                        where: { id: dataValues.CanceledSubscriptions[0].dataValues.id },
                    });
                    const subscription = yield suscriptions_1.default.create(Object.assign(Object.assign({}, data), { status: "active" }));
                    const { dataValues: dataSubscription } = subscription;
                    res.status(201).json({
                        message: `Subscription created successfully ${dataSubscription.type}`,
                    });
                    return;
                }
                else {
                    res.status(409).json({
                        message: "The user does not have a subscription",
                    });
                    return;
                }
            }
        }
        catch (error) {
            console.log("Error al activar", error);
            res.status(500).json({
                message: "Error creating user",
            });
        }
    }
});
exports.createActiveSubscriptions = createActiveSubscriptions;
const createCanceledSubscriptionsPause = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const user = yield users_1.default.findByPk(data.client, {
            include: suscriptions_1.default,
        });
        if (!user) {
            res.status(404).json({
                message: "The client does not exist",
            });
            return;
        }
        else {
            const { dataValues } = user;
            if (dataValues.Subscriptions.length) {
                yield suscriptions_1.default.update({ status: "pause-canceled" }, { where: { id: dataValues.Subscriptions[0].dataValues.id || 0 } });
                res.status(201).json({
                    message: "Subscription updated successfully",
                });
                return;
            }
            else {
                res.status(409).json({
                    message: "The user does not have a subscription",
                });
                return;
            }
        }
    }
    catch (error) {
        console.log("Error al activar", error);
        res.status(500).json({
            message: "Error creating user",
        });
    }
});
exports.createCanceledSubscriptionsPause = createCanceledSubscriptionsPause;
const createActiveSubscriptionsPause = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const user = yield users_1.default.findByPk(data.client, {
            include: suscriptions_1.default,
        });
        if (!user) {
            res.status(404).json({
                message: "The client does not exist",
            });
            return;
        }
        else {
            const { dataValues } = user;
            if (dataValues.Subscriptions.length) {
                yield suscriptions_1.default.update({ status: "pause" }, { where: { id: dataValues.Subscriptions[0].dataValues.id || 0 } });
                res.status(201).json({
                    message: "Subscription updated successfully",
                });
                return;
            }
            else {
                res.status(409).json({
                    message: "The user does not have a subscription",
                });
                return;
            }
        }
    }
    catch (error) {
        console.log("Error al activar", error);
        res.status(500).json({
            message: "Error creating user",
        });
    }
});
exports.createActiveSubscriptionsPause = createActiveSubscriptionsPause;
const getSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id || id === "undefined") {
        res.status(400).json({ error: "ID is missing" });
        return;
    }
    else {
        try {
            const user = yield users_1.default.findOne({
                where: { id },
                include: [suscriptions_1.default, canceled_subscriptions_1.default, preapprovald_subscriptions_1.default],
            });
            const { dataValues } = user;
            if (dataValues.Subscriptions.length &&
                !dataValues.CanceledSubscriptions.length) {
                const subscriptionData = dataValues.Subscriptions[0].dataValues;
                // El preapproval id se persiste en subscriptionId al crear la suscripción,
                // así evitamos una consulta en vivo a MercadoPago en cada lectura.
                res.status(200).json({
                    subscription: Object.assign(Object.assign({}, subscriptionData), { email: dataValues.email, date_limit: "", preapproval_id: subscriptionData.subscriptionId }),
                    preapproval: false,
                });
                return;
            }
            else if (dataValues.CanceledSubscriptions.length &&
                !dataValues.Subscriptions.length) {
                res.status(200).json({
                    subscription: Object.assign(Object.assign({}, dataValues.CanceledSubscriptions[0].dataValues), { email: dataValues.email }),
                    preapproval: false,
                });
                return;
            }
            else {
                res.status(200).json({
                    subscription: undefined,
                    preapproval: dataValues.PreapprovaldSubscription ? true : false,
                });
                return;
            }
        }
        catch (error) {
            res.status(500).json({
                message: "Error subscription",
            });
            return;
        }
    }
});
exports.getSuscription = getSuscription;
const getCanceledSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id || id === "undefined") {
        res.status(400).json({ error: "ID is missing" });
        return;
    }
    else {
        try {
            const user = yield users_1.default.findOne({
                where: { id },
                include: canceled_subscriptions_1.default,
            });
            const { dataValues } = user;
            if (dataValues.CanceledSubscriptions.length) {
                return res.status(200).json({
                    subscription: [dataValues.CanceledSubscriptions[0].dataValues],
                });
            }
            else {
                return res.status(200).json({ subscription: [] });
            }
        }
        catch (error) {
            res.status(500).json({
                error: "Error cancellation",
            });
            return;
        }
    }
});
exports.getCanceledSuscription = getCanceledSuscription;
const removeCanceledSuscription = (user) => __awaiter(void 0, void 0, void 0, function* () {
    if (user.CanceledSubscriptions.length) {
        yield canceled_subscriptions_1.default.destroy({
            where: { id: user.CanceledSubscriptions[0].dataValues.id },
        });
    }
});
const deleteSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: "ID required" });
        return;
    }
    else {
        yield suscriptions_1.default.destroy({ where: { id } });
        res.status(204).json({ message: "Subscription deleted" });
        return;
    }
});
exports.deleteSuscription = deleteSuscription;
const deleteCanceledSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: "ID required" });
        return;
    }
    else {
        yield canceled_subscriptions_1.default.destroy({ where: { id } });
        res.status(204).json({ message: "Subscription deleted" });
        return;
    }
});
exports.deleteCanceledSuscription = deleteCanceledSuscription;
const deletePreapprovald = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: "ID required" });
        return;
    }
    else {
        yield preapprovald_subscriptions_1.default.destroy({
            where: { client: id },
        });
    }
});
exports.deletePreapprovald = deletePreapprovald;
