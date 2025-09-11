/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/unbound-method */
import express, { NextFunction, Response, Request } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import { AuthController } from "@controllers/auth";
import ejs from "ejs";
import path from "path";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { redis } from "@config/redis-connection";
import { log } from "console";
import flash from "connect-flash";
import { EmailQueue } from "@queues/email-queue";
import * as OAuth from "passport-google-oauth20";
import passport, { Profile } from "passport";
import { User } from "@models/index";
// import { User } from "@models/user";
import { ProjectController } from "@controllers/project";
import { ReleaseController } from "@controllers/release";
import { DeviceController as DeviceRegistryController } from "@controllers/device";
import { ApiError } from "@utils/error";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { isDevEnvironment } from "@utils/utils";
import * as http from "node:http";

/**
 *
 * @todo Implement a feature at SDK level to register device on first use with unique-id and on
 * OnSuccessful flashing hit the tenant API to update the record for successfuly updating devices
 * per project and onFail update it as well...this device data would be shown as graphs on platform
 *
 * @todo Add Ping feature on bootup of device at sdk level to hit tenant based API with meta data of device
 * and running firmware version... Use MQTT protocol PUB/SUB pattern at low level sdk sub and server pub level...
 *
 * @todo Add location feature to track in dashboard at first pull fetch of release
 *
 * @todo Protect the Verification Page...
 *
 * @todo Refactor the OAuth code into DAL, services and controller...
 *
 * @todo Implement the password recovery module...
 *
 * @todo Write a fallback strategy at very low level of voyager sdk
 *
 * @todo Implement the [FirmwareBinIntegrityHashChecker] Module via Message Queue...
 * @description
 *      Enqueue the hash and worker process should pick up find and match the already
 *      uploaded firmware binaries hash with it on DB...then worker should dispatch events
 *      via Redis Pub/Sub Pattern save release records....
 *      OnFail:
 *          Remove the uploaded bin file and publish event
 *      OnMatch:
 *          Save the release record and publish event
 */

const app = express();

const httpServer = http.createServer(app);

const authRouter = express.Router();
const projectRouter = express.Router();
const releaseRouter = express.Router();
const deviceRegistryRouter = express.Router();

container.resolve(EmailQueue);

const authController = container.resolve(AuthController);
const projectController = container.resolve(ProjectController);
const releaseController = container.resolve(ReleaseController);
const deviceRegistryController = container.resolve(DeviceRegistryController);

app.engine("ejs", ejs.renderFile);

app.set("view engine", "ejs");

app.set("views", path.join(import.meta.dirname, "views"));

app.use(express.urlencoded({ extended: false }));

const redisStore = new RedisStore({ prefix: "voyager_", client: redis });

app.use(
  session({
    secret: "123",
    saveUninitialized: true,
    resave: false,
    store: redisStore,
  })
);

app.use(flash());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
authRouter.route("/").get(authController.getLandingPage);

authRouter
  .route("/auth/signup")
  .get(authController.getSignUpPage)
  .post(authController.signup.bind(authController));

authRouter
  .route("/auth/login")
  .get(authController.getLoginPage)
  .post(authController.login.bind(authController));

authRouter
  .route("/auth/verification")
  .get(authController.getOTPVerificationPage)
  .post(authController.verifyOTP.bind(authController));

authRouter
  .route("/auth/verification/resend")
  .get(authController.resendOTP.bind(authController));

authRouter.route("/auth/logout").get(authController.logout);

authRouter.route("/story").get(authController.getStoryPage);

releaseRouter.route("/").post(releaseController.postRelease.bind(releaseController));

projectRouter
  .route("/")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.postProject.bind(projectController));

projectRouter
  .route("/:project_id")
  .get(releaseController.getReleases.bind(releaseController));

deviceRegistryRouter
  .route("/device/auth")
  .post(deviceRegistryController.registerDevice.bind(deviceRegistryController))
  .get(deviceRegistryController.authenticate.bind(deviceRegistryController));

app.use("/", authRouter);
app.use("/projects", projectRouter);
app.use("/releases", releaseRouter);
app.use("/api/v1", deviceRegistryRouter);

app.get("/docs", (req, res) => res.render("docs"));
app.get("/releases", (req, res) => res.render("releases"));
app.get("/story", (req, res) => res.render("story"));

app.use(passport.session());
passport.use(
  new OAuth.Strategy(
    {
      clientID:
        "830853933786-tur7059m476cr6n7emkd24t4jecceibh.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "/auth/google/redirect",
    },
    async function verify(
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      callback: OAuth.VerifyCallback
    ): Promise<void> {
      const [user] = await User.findOrCreate({
        where: {
          google_id: profile.id,
        },

        defaults: {
          email: profile.emails![0].value,
          username: profile.displayName,
          picture_url: profile.photos![0].value,
        },
      });

      callback(null, user);
    }
  )
);

passport.serializeUser((user, cb) => {
  log("Serializing . . . . ");
  cb(null, {
    publicId: user.public_id,
    username: user.username,
    email: user.email,
    pictureURL: user.picture_url,
  });
});

passport.deserializeUser((user: User, cb) => {
  log("Deserializing . . . . ");
  cb(null, user);
});

authRouter
  .route("/auth/google/login")
  .get(passport.authenticate("google", { scope: ["email", "profile"] }));

authRouter.route("/auth/google/redirect").get(
  passport.authenticate("google", {
    failureRedirect: "/auth/login",
    successReturnToOrRedirect: "/dashboard",
    session: true,
  })
);

app.use("/", (error: unknown, req: Request, res: Response, next: NextFunction) => {
  log(error, " stack ", error.stack);
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      message: error.message,
      reason: getReasonPhrase(error.statusCode),
      code: error.statusCode,
      stackTrace: isDevEnvironment() ? error.stack : null,
    });
  }

  if (error instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      message: JSON.parse(error.message)[0].message,
      reason: getReasonPhrase(StatusCodes.BAD_REQUEST),
      code: StatusCodes.BAD_REQUEST,
      stackTrace: isDevEnvironment() ? error.stack : null,
    });
  }
  next();
});

httpServer.listen(3000, () => {
  if (process.env.NODE_ENV === "production") {
    log("production");
  } else {
    log("development");
  }
});

process.on("unhandledRejection", (r) => {
  console.error("UNHANDLED PROMISE REJECTION:", r);
});
