import { StatusCodes } from "http-status-codes";
import { isDevEnvironment } from "@config/config";
export class ApiError extends Error {
  constructor(
    public readonly message: string,
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
