import { DataTypes } from "sequelize";
import User from "./users";
import { sequelize } from "../database/connect";

const Subscription = sequelize.define(
  "Subscription",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantityProducts: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    numberProductsCreated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    type: {
      type: DataTypes.ENUM("Emprendedor", "Crecimiento", "Corporativo"),
      allowNull: false,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subscriptionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pause",
    },
    client: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    createdAt: "createdat",
    updatedAt: "updatedat",
    tableName: "subscriptions",
  }
);

Subscription.belongsTo(User, { foreignKey: "client" });
User.hasMany(Subscription, { foreignKey: "client" });

export default Subscription;
