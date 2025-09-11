import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@utils/utils";
import { Sequelize } from "sequelize";

export const db = new Sequelize({
  port: process.env.DB_PORT,
  database: process.env.DB,
  host: process.env.DB_HOST,
  dialect: "mariadb",
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  logging: (msg) => Logger.debug(msg),
});

try {
  await db.authenticate({ benchmark: isDevEnvironment() });
  Logger.info("DB Connected!");
} catch (error) {
  if (typeof error === "string") Logger.error(error);
}
