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
exports.getCanceledSuscription = exports.getSuscription = exports.createCanceledSubscriptions = exports.createSuscription = void 0;
const suscriptionSchema_1 = require("../schemas/suscriptionSchema");
const suscriptions_1 = __importDefault(require("../models/suscriptions"));
const users_1 = __importDefault(require("../models/users"));
const canceled_subscriptions_1 = __importDefault(require("../models/canceled_subscriptions"));
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
                yield deleteCanceledSuscription(dataValues);
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
const getSuscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id || id === "undefined") {
        res.status(400).json({ error: "ID is missing" });
        return;
    }
    else {
        try {
            const user = yield users_1.default.findOne({ where: { id }, include: suscriptions_1.default });
            const { dataValues } = user;
            if (dataValues.Subscriptions.length) {
                res
                    .status(200)
                    .json({ subscription: [dataValues.Subscriptions[0].dataValues] });
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
const deleteCanceledSuscription = (user) => __awaiter(void 0, void 0, void 0, function* () {
    if (user.CanceledSubscriptions.length) {
        yield canceled_subscriptions_1.default.destroy({
            where: { id: user.CanceledSubscriptions[0].dataValues.id },
        });
    }
});