/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import "@models/index"; // please do not change the order of import paths otherwise the models wont be initialized....
import { ApiError } from "@utils/error";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import "reflect-metadata";
import { projectWebRouter } from "@routes/web/project.routes";
import { releaseWebRouter } from "@routes/web/release.routes";
import { ZodError } from "zod";
import session from "express-session";
import { redis } from "@config/redis.connection.config";
import path from "path";
import { authWebRouter } from "@routes/web/auth.routes";
import { projectApiRouter } from "@routes/apis/project.routes";
import { deviceReleaseApiRouter, releaseApiRouter } from "@routes/apis/release.routes";
import { taskApiRouter } from "@routes/apis/artifact.task.routes";
import { isAuthenticated } from "middlewares/auth";
import morgan from "morgan";
import { Logger } from "@utils/logger";
import { PurgingCronJob } from "@cron/purge.cron";
import helmet from "helmet";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import * as UserDAL from "@dal/user.dal";
import * as OAuthCreds from "../oauth-client-secret.json";
import { EnvConfig, isDevEnvironment } from "@config/config";
import { RedisStore } from "connect-redis";

const app = express();

app.use(cors());

// todo: enable it later..
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

app.use(morgan("dev"));

const store = new RedisStore({
  client: redis,
  prefix: "vygr_sess:",
});

app.use(
  session({
    store: store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000 * 2, // 2 hours....
      sameSite: "lax",
    },
    name: "VGR_SESS",
    secret: EnvConfig.SESSION_SECRET,
  }),
);

app.set("view engine", "ejs");
app.set("views", path.join(import.meta.dirname, "views"));

app.use(express.static(path.join(import.meta.dirname, "..", "public")));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: OAuthCreds.web.client_id,
      clientSecret: OAuthCreds.web.client_secret,
      callbackURL: isDevEnvironment()
        ? OAuthCreds.web.redirect_uris[0]
        : OAuthCreds.web.redirect_uris[1],
    },
    function (_, __, profile, callback) {
      UserDAL.createOAuthUser({
        email: profile.emails![0].value,
        googleId: profile.id,
        googleProfilePic: profile.photos![0].value,
        username: profile.displayName,
      })
        .then(([user, _]) => {
          callback(null, user.public_id);
        })
        .catch((error) => {
          callback(error);
        });
    },
  ),
);

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/",
    successRedirect: "/dashboard",
  }),
);

passport.serializeUser((userId, done) => {
  done(null, userId);
});

passport.deserializeUser((id: string, done) => {
  UserDAL.findUserByPublicId(id)
    .then((user) => {
      done(null, user ?? false);
    })
    .catch((error) => {
      done(error);
    });
});

app.get("/", (_: Request, response: Response) => response.render("index"));
app.get("/story", (_: Request, response: Response) => response.render("story"));
app.get("/docs", (_: Request, response: Response) => response.render("docs"));

app.use("/auth", authWebRouter);
app.use("/dashboard", isAuthenticated, projectWebRouter);
app.use("/dashboard/projects", isAuthenticated, releaseWebRouter);

app.use("/api/v1/workspace", isAuthenticated, projectApiRouter);
app.use("/api/v1/workspace/projects", isAuthenticated, releaseApiRouter);
app.use("/api/v1/tasks", isAuthenticated, taskApiRouter);

app.use("/internal/api/v1/releases", deviceReleaseApiRouter);

app.use((_: Request, response: Response, __: NextFunction) => response.render("404"));

app.use((error: Error, _: Request, response: Response, next: NextFunction) => {
  Logger.error(error.message);
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      message: error.message,
      status: {
        reason: getReasonPhrase(error.statusCode),
        code: error.statusCode,
      },
      stackTrace: isDevEnvironment() ? error.stack : undefined,
    });
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
  }
  next();
});

app.listen(EnvConfig.PORT ?? 8080, "0.0.0.0", () => {
  Logger.info("Server has started . . . .");
  Logger.info(EnvConfig.BASE_URL);
  Logger.info(process.env.ENVIRONMENT);
  PurgingCronJob.start();
});

process.on("unhandledRejection", (e) => {
  Logger.error("UNHANDLED PROMISE REJECTION: %s", e as string);
});

process.on("uncaughtException", function (err) {
  Logger.error("UNHANDLED UNCAUGHT EXCEPTION: %s", err.message);
});
