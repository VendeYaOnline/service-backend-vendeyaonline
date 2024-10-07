import { DataTypes } from "sequelize";
import User from "./users";
import { sequelize } from "../database/connect";

const CanceledSubscription = sequelize.define(
  "CanceledSubscription",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("Tienda Online", "Página web"),
      allowNull: false,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    client: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  },
  {
    timestamps: true,
    createdAt: "createdat",
    updatedAt: "updatedat",
    tableName: "canceled_subscriptions",
  }
);

CanceledSubscription.belongsTo(User, { foreignKey: "client" });
User.hasMany(CanceledSubscription, { foreignKey: "client" });

export default CanceledSubscription;
