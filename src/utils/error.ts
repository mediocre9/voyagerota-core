import { StatusCodes } from "http-status-codes";
import { isDevEnvironment } from "@config/config";
export class ApiError extends Error {
  constructor(
    public override message: string,
    public readonly statusCode: StatusCodes,
    public readonly uuid?: string,
    stack?: string,
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack ?? this.stack;
    }
  }
}

export type PlanLimitKind =
  | "projects"
  | "devices"
  | "releases"
  | "emailAlerts"
  | "autoRevoke"
  | "preAddDevices";

// 402 so the dashboard can tell a plan limit apart from any other refusal....
export class PlanLimitError extends ApiError {
  constructor(
    message: string,
    public readonly limit: PlanLimitKind,
  ) {
    super(message, StatusCodes.PAYMENT_REQUIRED);
  }
}
