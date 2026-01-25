import winston, { format } from "winston";
import path from "path";
import chalk from "chalk";
import { isDevEnvironment } from "@config/config";

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 10000,
    }),

    new winston.transports.Console({
      format: format.combine(
        format.timestamp({ format: () => new Date().toUTCString() }),
        format.splat(),
        format.printf(({ level, message, _, timestamp }) => {
          if (isDevEnvironment()) {
            const formattedMessage = `[${chalk.bold.underline(level.toUpperCase())}] : ${chalk(
              message as string,
            )} ${chalk.dim(` - ${timestamp as string}`)}`;

            switch (level) {
              case "info":
                return chalk.rgb(0, 255, 64).visible(formattedMessage); // purple....

              case "debug":
                return chalk.rgb(255, 213, 0).visible(formattedMessage); // yellow......

              case "warn":
                return chalk.rgb(255, 106, 0).visible(formattedMessage); // orange....

              default:
                return chalk.rgb(255, 0, 0).visible(formattedMessage); // red....
            }
          } else {
            return `[${level.toUpperCase()}] : ${message as string} - ${timestamp as string}`;
          }
        }),
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join("logs", "exceptions.log") }),
  ],
});

export const Logger = {
  info(message: string, ...args: string[]) {
    logger.info(message, args);
  },

  debug(message: string, ...args: string[]) {
    logger.debug(message, args);
  },

  warn(message: string, ...args: string[]) {
    logger.warn(message, args);
  },

  error(message: string, ...args: string[]) {
    logger.error(message, args);
  },
};
