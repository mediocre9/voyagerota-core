import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@utils/utils";
import { Sequelize } from "sequelize";

export const db = new Sequelize({
  port: 3306,
  database: "voyager_ota_dev",
  host: "localhost",
  dialect: "mariadb",
  username: "root",
  password: "123",
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
