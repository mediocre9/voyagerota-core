/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import { isAuthenticated, requireUser } from "@middlewares/auth";
import { clerkMiddleware } from "@clerk/express";
import { isClerkEnabled } from "@config/clerk.config";
import morgan from "morgan";
import { Logger } from "@utils/logger";
import helmet from "helmet";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import * as UserDAL from "@dal/user.dal";
import { EnvConfig, isDevEnvironment } from "@config/config";
import { resolveGoogleOAuthConfig } from "@config/oauth.config";
import { RedisStore } from "connect-redis";

const app = express();

app.set("trust proxy", 1);

app.use(cors());

// todo: enable it later..
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

app.use(morgan("combined"));

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

// clerk only verifies bearer tokens / cookies here, routes decide what is protected....
if (isClerkEnabled()) {
  app.use(clerkMiddleware());
} else {
  Logger.warn("Clerk is not configured. SPA authentication is disabled.");
}

const { credentials: googleOAuthCredentials, missing: missingGoogleOAuthConfig } =
  resolveGoogleOAuthConfig();

if (googleOAuthCredentials) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleOAuthCredentials.clientID,
        clientSecret: googleOAuthCredentials.clientSecret,
        callbackURL: googleOAuthCredentials.callbackURL,
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
} else if (isDevEnvironment()) {
  Logger.warn(
    `Google OAuth is not configured. Missing: ${missingGoogleOAuthConfig.join(", ")}. OAuth login is disabled.`,
  );
} else {
  throw new Error(
    `Google OAuth is not configured. Missing: ${missingGoogleOAuthConfig.join(", ")}.`,
  );
}

if (googleOAuthCredentials) {
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/",
      successRedirect: "/dashboard",
    }),
  );
} else {
  const oauthUnavailable = (_: Request, response: Response) =>
    response.status(StatusCodes.SERVICE_UNAVAILABLE).send("Google OAuth is not configured.");

  app.get("/auth/google", oauthUnavailable);
  app.get("/auth/google/callback", oauthUnavailable);
}

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

app.use("/api/v1/workspace", requireUser, projectApiRouter);
app.use("/api/v1/workspace/projects", requireUser, releaseApiRouter);
app.use("/api/v1/tasks", requireUser, taskApiRouter);

app.use("/internal/api/v1/releases", deviceReleaseApiRouter);

app.use((_: Request, response: Response, __: NextFunction) => {
  response.status(StatusCodes.NOT_FOUND).render("404");
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
