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
exports.ManualSynchronizationPreapprovald = void 0;
const sequelize_1 = require("sequelize");
const users_1 = __importDefault(require("./users"));
const connect_1 = require("../database/connect");
const PreapprovaldSubscription = connect_1.sequelize.define("PreapprovaldSubscription", {
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    client: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: users_1.default,
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
    },
}, {
    timestamps: false,
    tableName: "preapproval_subscription",
});
PreapprovaldSubscription.belongsTo(users_1.default, { foreignKey: "client" });
users_1.default.hasOne(PreapprovaldSubscription, { foreignKey: "client" });
const ManualSynchronizationPreapprovald = () => __awaiter(void 0, void 0, void 0, function* () {
    yield PreapprovaldSubscription.sync({ force: true, logging: true });
});
exports.ManualSynchronizationPreapprovald = ManualSynchronizationPreapprovald;
exports.default = PreapprovaldSubscription;
