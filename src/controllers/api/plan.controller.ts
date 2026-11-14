import { PLANS, TRIAL_DAYS } from "@config/plans";
import { UserLocals } from "@middlewares/auth";
import * as PlanService from "@services/plan.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

const status = (code: StatusCodes) => ({ reason: getReasonPhrase(code), code });

@injectable()
export class PlanController {
  // the signed in user's plan, its limits and what is used right now....
  async getPlan(_: Request, response: Response<unknown, UserLocals>, next: NextFunction) {
    try {
      const user = response.locals.user;
      const plan = PlanService.getAccountPlan(user);
      const usage = await PlanService.getAccountUsage(user);
      response.status(StatusCodes.OK).json({
        plan: {
          name: plan.name,
          paidPlan: plan.paidPlan,
          isTrial: plan.isTrial,
          trialEndsAt: plan.trialEndsAt,
        },
        limits: plan.limits,
        usage,
        status: status(StatusCodes.OK),
      });
    } catch (error) {
      next(error);
    }
  }

  // public, the pricing page reads the same numbers the server enforces....
  getCatalog(_: Request, response: Response, next: NextFunction) {
    try {
      response.status(StatusCodes.OK).json({
        plans: PLANS,
        trialDays: TRIAL_DAYS,
        status: status(StatusCodes.OK),
      });
    } catch (error) {
      next(error);
    }
  }
}
