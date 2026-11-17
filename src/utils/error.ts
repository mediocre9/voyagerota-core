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

export type LimitKind = "projects" | "devices" | "releases";

// 409 with the limit's name so the dashboard can explain which limit was reached....
export class LimitError extends ApiError {
  constructor(
    message: string,
    public readonly limit: LimitKind,
  ) {
    super(message, StatusCodes.CONFLICT);
  }
}
