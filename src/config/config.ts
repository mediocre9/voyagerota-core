import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env.development") });

export const EnvConfig = {
  BROKER_BASIC_AUTH_CREDENTIALS: process.env.BROKER_BASIC_AUTH_CREDENTIALS,
  PORT: parseInt(process.env.PORT),
  SESSION_SECRET: process.env.SESSION_SECRET,
  BASE_URL: isDevEnvironment()
    ? process.env.BASE_URL.concat(":").concat(process.env.PORT.toString())
    : process.env.BASE_URL,

  ENVIRONMENT: process.env.ENVIRONMENT,
  DB_PORT: parseInt(process.env.DB_PORT),
  DB_NAME: process.env.DB_NAME,
  DB_HOST: process.env.DB_HOST,
  DB_USERNAME: process.env.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD,

  MQTT_ADDRESS: process.env.MQTT_ADDRESS,
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT,
  MQTT_USERNAME: process.env.MQTT_USERNAME,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD,
  MQTT_PORT: parseInt(process.env.MQTT_PORT),
};

export function isDevEnvironment(): boolean {
  return process.env.ENVIRONMENT === "development";
}
