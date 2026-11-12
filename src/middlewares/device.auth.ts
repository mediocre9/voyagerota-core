import * as crypto from "node:crypto";
import * as ProjectDAL from "@dal/project.dal";
import { Project } from "@models/project.model";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export const DeviceHeaders = {
  API_KEY: "x-api-key",
  PROJECT_ID: "x-project-id",
} as const;

/**
 * Locals attached by {@link authenticateDevice} for device facing routes.
 */
export type DeviceLocals = { project: Project };

function isSameSecret(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

/**
 * @description Authenticates end devices (VoyagerOTAClient) via the
 * `x-project-id` and `x-api-key` headers. On success the resolved project is
 * attached to `response.locals.project` so every downstream handler is scoped
 * to the caller's own project.
 *
 * Invalid or unknown credentials always return the same 401 so callers can't
 * tell whether a project id exists.
 */
export async function authenticateDevice(
  request: Request,
  response: Response<unknown, DeviceLocals>,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKey = request.get(DeviceHeaders.API_KEY)?.trim();
    const projectId = request.get(DeviceHeaders.PROJECT_ID)?.trim();

    if (!apiKey || !projectId) {
      throw new ApiError(
        `${DeviceHeaders.PROJECT_ID} and ${DeviceHeaders.API_KEY} headers are required!`,
        StatusCodes.UNAUTHORIZED,
      );
    }

    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project || !isSameSecret(project.getApiKey(), apiKey)) {
      throw new ApiError("Invalid project credentials!", StatusCodes.UNAUTHORIZED);
    }

    response.locals.project = project;
    next();
  } catch (error) {
    next(error);
  }
}
