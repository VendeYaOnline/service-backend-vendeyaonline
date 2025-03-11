"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const users_1 = __importDefault(require("./users"));
const connect_1 = require("../database/connect");
const CanceledSubscription = connect_1.sequelize.define("CanceledSubscription", {
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    price: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    quantityProducts: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    type: {
        type: sequelize_1.DataTypes.ENUM("Emprendedor", "Crecimiento", "Corporativo"),
        allowNull: false,
    },
    date: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    client: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: users_1.default,
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
    },
}, {
    timestamps: true,
    createdAt: "createdat",
    updatedAt: "updatedat",
    tableName: "canceled_subscriptions",
});
CanceledSubscription.belongsTo(users_1.default, { foreignKey: "client" });
users_1.default.hasMany(CanceledSubscription, { foreignKey: "client" });
exports.default = CanceledSubscription;
