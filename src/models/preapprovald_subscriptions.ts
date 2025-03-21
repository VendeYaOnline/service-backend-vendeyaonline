import { DataTypes } from "sequelize";
import User from "./users";
import { sequelize } from "../database/connect";

const PreapprovaldSubscription = sequelize.define(
  "PreapprovaldSubscription",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    timestamps: false,
    tableName: "preapproval_subscription",
  }
);

PreapprovaldSubscription.belongsTo(User, { foreignKey: "client" });
User.hasOne(PreapprovaldSubscription, { foreignKey: "client" });

export const ManualSynchronizationPreapprovald = async () => {
  await PreapprovaldSubscription.sync({ force: true, logging: true });
};

export default PreapprovaldSubscription;
