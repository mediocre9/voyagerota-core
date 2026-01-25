import { Logger } from "@utils/logger";
import { Router } from "express";

export const authWebRouter = Router();

authWebRouter.route("/logout").get((request, response) =>
  request.session.destroy((error: Error) => {
    if (error) {
      Logger.error(error.message);
      return;
    }
    response.redirect("/");
  }),
);
