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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.deleteUser = exports.updatedUser = exports.getUserByEmail = exports.updatedPasswordEmail = exports.updatedPassword = exports.loginUser = exports.createUser = void 0;
const users_1 = __importDefault(require("../models/users"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userSchema_1 = require("../schemas/userSchema");
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const { error } = userSchema_1.userSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        else {
            const hashedPassword = yield bcrypt_1.default.hash(data.password, 10);
            data.password = hashedPassword;
            const user = yield users_1.default.create(data);
            const { dataValues } = user;
            const token = jsonwebtoken_1.default.sign({ email: dataValues.email }, process.env.JWT_SECRET, {
                expiresIn: "10h",
            });
            const { password } = dataValues, rest = __rest(dataValues, ["password"]);
            res.status(201).json({ user: rest, token });
            return;
        }
    }
    catch (error) {
        if (error.errors[0].message === "email must be unique") {
            res.status(500).json({
                error: `The user already exists`,
            });
            return;
        }
        else {
            res.status(500).json({
                error: `Error creating user - ${error.errors[0].message}`,
            });
            return;
        }
    }
});
exports.createUser = createUser;
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const { error } = userSchema_1.loginSchema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        else {
            const user = yield users_1.default.findOne({ where: { email } });
            if (!user) {
                res.status(404).json({ error: "Incorrect password or email" });
                return;
            }
            else {
                const isMatch = yield bcrypt_1.default.compare(password, user.dataValues.password);
                if (!isMatch) {
                    res.status(401).json({ error: "Incorrect password or email" });
                    return;
                }
                const { dataValues } = user;
                const token = jsonwebtoken_1.default.sign({ id: dataValues.id, email: dataValues.email }, process.env.JWT_SECRET, {
                    expiresIn: "10h",
                });
                const { password: password2 } = dataValues, rest = __rest(dataValues, ["password"]);
                res.status(200).json({ user: rest, token });
                return;
            }
        }
    }
    catch (error) {
        res.status(500).json({ error: "Login error" });
        return;
    }
});
exports.loginUser = loginUser;
const updatedPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, newPassword } = req.body;
        const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
        yield users_1.default.update({ password: hashedPassword }, {
            where: { id },
        });
        res.status(200).json({ message: "Updated password" });
        return;
    }
    catch (error) {
        res.status(500).json({ error: "Error updating password" });
        return;
    }
});
exports.updatedPassword = updatedPassword;
const updatedPasswordEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, newPassword } = req.body;
        const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
        yield users_1.default.update({ password: hashedPassword }, {
            where: { email },
        });
        res.status(200).json({ message: "Updated password" });
        return;
    }
    catch (error) {
        res.status(500).json({ error: "Error updating password" });
        return;
    }
});
exports.updatedPasswordEmail = updatedPasswordEmail;
const getUserByEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.params;
        const user = yield users_1.default.findOne({ where: { email } });
        const { dataValues } = user;
        const { username } = dataValues;
        res.status(200).json({ user: username });
        return;
    }
    catch (error) {
        res.status(404).json({ error: "User not found" });
        return;
    }
});
exports.getUserByEmail = getUserByEmail;
const updatedUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const data = req.body;
        yield users_1.default.update(Object.assign({}, data), {
            where: { id },
        });
        const user = yield users_1.default.findOne({ where: { email: data.email } });
        const { dataValues } = user;
        const { password } = dataValues, rest = __rest(dataValues, ["password"]);
        res.status(201).json(Object.assign({}, rest));
        return;
    }
    catch (error) {
        res.status(404).json({ error: "User not found" });
        return;
    }
});
exports.updatedUser = updatedUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const response = yield users_1.default.destroy({
            where: { id },
        });
        if (response === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        else {
            return res.status(204).json({ message: "User successfully deleted" });
        }
    }
    catch (error) {
        console.log("asdasd", error);
        res.status(404).json({ message: "User not found" });
        return;
    }
});
exports.deleteUser = deleteUser;
const getAllUsers = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield users_1.default.findAll();
        res.status(200).json(users);
        return;
    }
    catch (error) {
        res.status(404).json({ message: "User not found" });
        return;
    }
});
exports.getAllUsers = getAllUsers;
