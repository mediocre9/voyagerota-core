/* eslint-disable @typescript-eslint/no-unsafe-argument */
import "@models/index";
import { ApiError } from "@utils/error";
import { isDevEnvironment } from "@utils/utils";
import { log } from "console";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import "reflect-metadata";
import { artifactTaskRouter } from "@routes/artifact.task.routes";
import { projectRouter } from "@routes/project.routes";
import { releaseRouter } from "@routes/release.routes";
import { ZodError } from "zod";

const app = express();

app.use(cors());

app.use(helmet());

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

app.get("/", (_, res) => res.json({ health: "running" }));
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/releases", releaseRouter);
app.use("/api/v1/tasks", artifactTaskRouter);

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      message: error.message,
      status: {
        reason: getReasonPhrase(error.statusCode),
        code: error.statusCode,
      },
      stackTrace: isDevEnvironment() ? error.stack : null,
    });
  }

  if (error instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      message: error.issues[0].message,
      status: {
        reason: getReasonPhrase(StatusCodes.BAD_REQUEST),
        code: StatusCodes.BAD_REQUEST,
      },
      stackTrace: isDevEnvironment() ? error.stack : null,
    });
  }
  next();
});

app.listen(3000, () => {
  log("running at http://localhost:3000/api/v1/");
  log(process.env.NODE_ENV);

  // PurgeCronJob.start();
});

process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED PROMISE REJECTION:", e);
});
