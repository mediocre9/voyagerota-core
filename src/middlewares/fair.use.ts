import { isDevEnvironment } from "@config/config";
import { CHECK_IN_INTERVAL_SECONDS, PROJECT_REQUESTS_PER_MINUTE } from "@config/plans";
import { redis } from "@config/redis.connection.config";
import { DeviceLocals, ProjectKeyLocals } from "@middlewares/device.auth";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

// in development a board can be re-flashed and checked every few seconds....
const CHECK_IN_INTERVAL = isDevEnvironment() ? 5 : CHECK_IN_INTERVAL_SECONDS;

function _tooManyRequests(response: Response, retryAfter: number, message: string): void {
  response.set("Retry-After", String(Math.max(1, retryAfter)));
  response.status(StatusCodes.TOO_MANY_REQUESTS).json({
    message,
    status: {
      reason: getReasonPhrase(StatusCodes.TOO_MANY_REQUESTS),
      code: StatusCodes.TOO_MANY_REQUESTS,
    },
  });
}

// a whole project can't flood the server, whatever its devices do....
async function _isProjectOverBudget(projectId: number): Promise<number> {
  const window = Math.floor(Date.now() / 60_000);
  const key = `vygr:fairuse:project:${projectId}:${window}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count > PROJECT_REQUESTS_PER_MINUTE ? 60 - (Math.floor(Date.now() / 1000) % 60) : 0;
}

// one check-in per device per interval, the same on every plan....
export async function limitDeviceCheckIns(
  _: Request,
  response: Response<unknown, DeviceLocals>,
  next: NextFunction,
): Promise<void> {
  try {
    const { device, project } = response.locals;
    const key = `vygr:fairuse:device:${device.id}`;
    if ((await redis.set(key, "1", "EX", CHECK_IN_INTERVAL, "NX")) !== "OK") {
      const ttl = await redis.ttl(key);
      _tooManyRequests(response, ttl, `Checking in too often, try again in ${ttl}s.`);
      return;
    }

    const wait = await _isProjectOverBudget(project.getId());
    if (wait) {
      _tooManyRequests(response, wait, "This project is sending too many requests.");
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function limitProjectRequests(
  _: Request,
  response: Response<unknown, ProjectKeyLocals>,
  next: NextFunction,
): Promise<void> {
  try {
    const wait = await _isProjectOverBudget(response.locals.project.getId());
    if (wait) {
      _tooManyRequests(response, wait, "This project is sending too many requests.");
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
