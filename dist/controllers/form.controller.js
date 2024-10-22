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
exports.deleteForm = exports.updatedForm = exports.registerForm = exports.getAllForms = void 0;
const form_1 = __importDefault(require("../models/form"));
const userSchema_1 = require("../schemas/userSchema");
const getAllForms = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield form_1.default.findAll();
        if (response.length) {
            res.status(200).json({ forms: response });
            return;
        }
        else {
            res.status(200).json({ forms: [] });
            return;
        }
    }
    catch (error) {
        res.status(500).json({ message: error });
        return;
    }
});
exports.getAllForms = getAllForms;
const registerForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    const { error } = userSchema_1.formSchema.validate(req.body);
    try {
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        else {
            yield form_1.default.create(data);
            res.status(201).json({ message: "Registered message" });
            return;
        }
    }
    catch (error) {
        res.status(400).json({ error: error.errors[0].message });
        return;
    }
});
exports.registerForm = registerForm;
const updatedForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    const { id } = req.params;
    const { error } = userSchema_1.formSchemaUpdated.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    else {
        yield form_1.default.update(data, { where: { id } });
        res.status(201).json({ message: "Form updated" });
        return;
    }
});
exports.updatedForm = updatedForm;
const deleteForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: "ID required" });
        return;
    }
    else {
        yield form_1.default.destroy({ where: { id } });
        res.status(204).json({ message: "Deleted message" });
        return;
    }
});
exports.deleteForm = deleteForm;
