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
  // Cambios de precio de los complementos (utils/addon-prices.ts).
  await sequelize.query(`CREATE TABLE IF NOT EXISTS addon_price_changes (
    id SERIAL PRIMARY KEY,
    addon VARCHAR(40) NOT NULL,
    old_price INTEGER NOT NULL,
    new_price INTEGER NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    results JSON,
    created_by VARCHAR(254),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
  )`);
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
