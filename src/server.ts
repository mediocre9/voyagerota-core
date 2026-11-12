import "@models/index"; // please do not change the order of import paths otherwise the models wont be initialized....
import "reflect-metadata";
import { clerkMiddleware } from "@clerk/express";
import { isClerkEnabled } from "@config/clerk.config";
import { EnvConfig, isDevEnvironment } from "@config/config";
import { requireUser } from "@middlewares/auth";
import { taskApiRouter } from "@routes/apis/artifact.task.routes";
import { projectApiRouter } from "@routes/apis/project.routes";
import { deviceReleaseApiRouter, releaseApiRouter } from "@routes/apis/release.routes";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import morgan from "morgan";
import { ZodError } from "zod";

if (!isClerkEnabled()) {
  const message = "Clerk is not configured. Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY.";
  if (!isDevEnvironment()) {
    // winston only writes uncaught exceptions to logs/exceptions.log, so say it on the console too....
    Logger.error(message);
    process.exit(1);
  }
  Logger.warn(`${message} Dashboard APIs will answer 401, device APIs keep working.`);
}

const app = express();

app.set("trust proxy", 1);

// auth is bearer tokens only (no cookies), so an open cors policy is safe here....
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("combined"));

if (isClerkEnabled()) {
  app.use(clerkMiddleware());
}

app.get("/health", (_: Request, response: Response) => {
  response.status(StatusCodes.OK).json({ status: "ok" });
});

// dashboard apis for voyagerota-web (clerk)....
app.use("/api/v1/workspace", requireUser, projectApiRouter);
app.use("/api/v1/workspace/projects", requireUser, releaseApiRouter);
app.use("/api/v1/tasks", requireUser, taskApiRouter);

// device apis for VoyagerOTAClient (project id + api key)....
app.use("/internal/api/v1/releases", deviceReleaseApiRouter);

app.use((_: Request, response: Response) => {
  response.status(StatusCodes.NOT_FOUND).json({
    message: "Route not found!",
    status: {
      reason: getReasonPhrase(StatusCodes.NOT_FOUND),
      code: StatusCodes.NOT_FOUND,
    },
  });
});

app.use((error: Error, _: Request, response: Response, next: NextFunction) => {
  Logger.error(error.message);

  // a response is already streaming (e.g. firmware download), let express close it....
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      message: error.message,
      status: {
        reason: getReasonPhrase(error.statusCode),
        code: error.statusCode,
      },
      stackTrace: isDevEnvironment() ? error.stack : undefined,
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(StatusCodes.BAD_REQUEST).json({
      message: error.issues[0].message,
      status: {
        reason: getReasonPhrase(StatusCodes.BAD_REQUEST),
        code: StatusCodes.BAD_REQUEST,
      },
      stackTrace: isDevEnvironment() ? error.stack : undefined,
    });
    return;
  }

  response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: isDevEnvironment() ? error.message : "Something went wrong!",
    status: {
      reason: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
      code: StatusCodes.INTERNAL_SERVER_ERROR,
    },
    stackTrace: isDevEnvironment() ? error.stack : undefined,
  });
});

app.listen(EnvConfig.PORT ?? 8080, "0.0.0.0", () => {
  Logger.info("Server has started . . . .");
  Logger.info(EnvConfig.BASE_URL);
  Logger.info(process.env.ENVIRONMENT);
});

process.on("unhandledRejection", (e) => {
  Logger.error("UNHANDLED PROMISE REJECTION: %s", e as string);
});

process.on("uncaughtException", function (err) {
  Logger.error("UNHANDLED UNCAUGHT EXCEPTION: %s", err.message);
});
