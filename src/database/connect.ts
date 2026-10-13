import dotenv from "dotenv";
import { Sequelize } from "sequelize";
dotenv.config();

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: false,
});

/**
 * Cambios aditivos del esquema, al arrancar. Nunca borra ni modifica datos:
 * solo agrega lo que falta (columnas nuevas con valor por defecto).
 */
export const ensureSchema = async () => {
  await sequelize.query(
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addons JSON NOT NULL DEFAULT '[]'::json`
  );
};

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
