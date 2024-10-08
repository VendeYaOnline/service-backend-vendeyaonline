import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import User from "../models/users";
dotenv.config();

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: false,
});

export const syncDatabase = async () => {
  try {
    // Sincroniza los modelos con la base de datos
    await sequelize.sync({ force: false }); // Cambia a 'true' si deseas eliminar las tablas existentes y recrearlas
    console.log("Las tablas han sido sincronizadas correctamente.");
  } catch (error) {
    console.error("Error al sincronizar las tablas:", error);
  }
};

export const resetDatabase = async () => {
  try {
    const models = sequelize.models;

    // Vaciar todas las tablas sin eliminarlas
    for (const modelName in models) {
      if (Object.hasOwnProperty.call(models, modelName)) {
        await models[modelName].destroy({ where: {}, truncate: true });
      }
    }

    console.log("Todas las tablas han sido vaciadas correctamente.");
  } catch (error) {
    console.error("Error al vaciar las tablas:", error);
  }
};

export const dropTables = async () => {
  try {
    await sequelize.sync(); // Sincroniza primero para asegurarte de que los modelos están definidos
    await User.drop(); // Elimina la tabla de usuarios
    console.log("Las tablas han sido eliminadas.");
  } catch (error) {
    console.error("Error al eliminar las tablas:", error);
  }
};
