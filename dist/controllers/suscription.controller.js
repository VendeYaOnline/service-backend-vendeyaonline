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
exports.deleteCanceledSuscription = exports.deleteSuscription = exports.getCanceledSuscription = exports.getSuscription = exports.createActiveSubscriptions = exports.createCanceledSubscriptions = exports.cancellationsSuscription = exports.updatedSuscription = exports.createSuscription = exports.getAllCancellations = exports.getAllSuscription = void 0;
const suscriptionSchema_1 = require("../schemas/suscriptionSchema");
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const users_1 = __importDefault(require("../models/users"));
const canceled_subscriptions_1 = __importDefault(require("../models/canceled_subscriptions"));
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
            error: `Error subscription - ${error.errors[0].message}`,
        });
        return;
    }
});
exports.getAllSuscription = getAllSuscription;
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
            error: `Error subscription - ${error.errors[0].message}`,
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
                error: `Error creating user - ${error.errors[0].message}`,
            });
        }
    }
});
exports.createSuscription = createSuscription;
const updatedSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { error } = suscriptionSchema_1.suscriptionSchemaUpdated.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        try {
            const data = req.body;
            const { id } = req.params;
            yield suscriptions_1.default.update(data, {
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
exports.updatedSuscription = updatedSuscription;
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
            res.status(500).json({
                error: `Error creating user - ${error.errors[0].message}`,
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
                console.log("dataValues", dataValues);
                if (dataValues.CanceledSubscriptions.length) {
                    yield canceled_subscriptions_1.default.destroy({
                        where: { id: dataValues.CanceledSubscriptions[0].dataValues.id },
                    });
                    const subscription = yield suscriptions_1.default.create(data);
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
            res.status(500).json({
                error: `Error creating user - ${error.errors[0].message}`,
            });
        }
    }
});
exports.createActiveSubscriptions = createActiveSubscriptions;
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
                include: [suscriptions_1.default, canceled_subscriptions_1.default],
            });
            const { dataValues } = user;
            if (dataValues.Subscriptions.length &&
                !dataValues.CanceledSubscriptions.length) {
                res.status(200).json({
                    subscription: Object.assign(Object.assign({}, dataValues.Subscriptions[0].dataValues), { status: "Activo" }),
                });
                return;
            }
            else if (dataValues.CanceledSubscriptions.length &&
                !dataValues.Subscriptions.length) {
                res.status(200).json({
                    subscription: Object.assign(Object.assign({}, dataValues.CanceledSubscriptions[0].dataValues), { status: "Proceso de cancelación" }),
                });
                return;
            }
            else {
                res.status(200).json({ subscription: undefined });
                return;
            }
        }
        catch (error) {
            res.status(500).json({
                error: `Error subscription - ${error.errors[0].message}`,
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
                error: `Error cancellation - ${error.errors[0].message}`,
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
