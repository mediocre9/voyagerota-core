import { StatusCodes } from "http-status-codes";
import { isDevEnvironment } from "./utils";

export class AuthError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: StatusCodes,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack ?? this.stack;
    }
  }
}

export class BrokerServiceError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class AccountNotVerifiedError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class UserNotFoundError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class ResourceNotFoundError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: StatusCodes,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack ?? this.stack;
    }
  }
}

export class BadRequestError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class InternalServerError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class ConflictError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly message: string,
    public readonly uuid?: string,
    stack?: string
  ) {
    super(message);

    if (isDevEnvironment()) {
      this.stack = stack;
    }
  }
}
