"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const users_1 = __importDefault(require("./users"));
const connect_1 = require("../database/connect");
const Subscription = connect_1.sequelize.define("Subscription", {
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    price: {
        type: sequelize_1.DataTypes.INTEGER,
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
        onDelete: "CASCADE",
    },
}, {
    timestamps: true,
    createdAt: "createdat", // Renombrar la columna
    updatedAt: "updatedat", // Renombrar la columna
    tableName: "subscriptions",
});
Subscription.belongsTo(users_1.default, { foreignKey: "client" });
users_1.default.hasMany(Subscription, { foreignKey: "client" });
exports.default = Subscription;
