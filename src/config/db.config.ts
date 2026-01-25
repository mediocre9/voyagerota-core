import { Logger } from "@utils/logger";

import { Sequelize } from "sequelize";
import { isDevEnvironment, EnvConfig } from "./config";

export const db = new Sequelize({
  port: EnvConfig.DB_PORT,
  database: EnvConfig.DB_NAME,
  host: EnvConfig.DB_HOST,
  dialect: "mariadb",
  username: EnvConfig.DB_USERNAME,
  password: EnvConfig.DB_PASSWORD,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: (msg) => Logger.debug(msg),
});

try {
  await db.authenticate({ benchmark: isDevEnvironment() });
  Logger.info("DB Connected!");
} catch (error) {
  if (typeof error === "string") Logger.error(error);
}
