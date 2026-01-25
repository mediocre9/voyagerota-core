import winston, { format } from "winston";
import path from "path";

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: "error",
      format: format.combine(
        format.colorize({ all: true }),
        format.printf((info): string => {
          if (typeof info.level === "string" && typeof info.message === "string") {
            return `${info.level}: ${info.message} at ${new Date().toString()}`;
          }
          return "";
        })
      ),
    }),

    new winston.transports.Console({
      level: "debug",
      format: format.combine(
        format.colorize({ all: true, colors: { debug: "yellow" } }),
        format.printf(
          ({ level, message }) => `${level}: ${message as string} at ${new Date().toString()}`
        )
      ),
    }),

    new winston.transports.Console({
      level: "info",
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(
          ({ level, message }) => `${level}: ${message as string} at ${new Date().toString()}`
        )
      ),
    }),

    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 10000,
    }),
  ],
});

export const Logger = {
  info(message: string) {
    logger.info(message);
  },

  debug(message: string) {
    logger.debug(message);
  },

  warn(message: string) {
    logger.warn(message);
  },

  error(message: string) {
    logger.error(message);
  },
};
