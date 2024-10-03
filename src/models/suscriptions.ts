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
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("Tienda Online", "Página web"),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    client: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    timestamps: true,
    createdAt: "createdat", // Renombrar la columna
    updatedAt: "updatedat", // Renombrar la columna
    tableName: "subscriptions",
  }
);

Subscription.belongsTo(User, { foreignKey: "client" });
User.hasMany(Subscription, { foreignKey: "client" });

export default Subscription;
