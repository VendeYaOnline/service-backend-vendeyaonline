"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const form_controller_1 = require("../controllers/form.controller");
const route = (0, express_1.Router)();
route.post("/register-form", form_controller_1.registerForm);
exports.default = route;
