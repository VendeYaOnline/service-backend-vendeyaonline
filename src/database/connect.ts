import dotenv from "dotenv";
import { Sequelize } from "sequelize";
dotenv.config();

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: false,
});

export const resetDatabase = async () => {
  try {
    await sequelize.sync({ force: true }); // Esto eliminará y volverá a crear todas las tablas
    console.log(
      "Todas las tablas han sido eliminadas y recreadas correctamente."
    );
  } catch (error) {
    console.error("Error al resetear la base de datos:", error);
  }
};
