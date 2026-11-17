import { LIMITS } from "@config/limits";
import { UserLocals } from "@middlewares/auth";
import * as LimitsService from "@services/limits.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

const status = (code: StatusCodes) => ({ reason: getReasonPhrase(code), code });

@injectable()
export class UsageController {
  // the account's limits and what is used right now....
  async getUsage(_: Request, response: Response<unknown, UserLocals>, next: NextFunction) {
    try {
      const usage = await LimitsService.getAccountUsage(response.locals.user.getId());
      response
        .status(StatusCodes.OK)
        .json({ limits: LIMITS, usage, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }
}
