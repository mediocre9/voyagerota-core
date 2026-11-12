import * as crypto from "node:crypto";
import * as ProjectDAL from "@dal/project.dal";
import { Project } from "@models/project.model";
import { AuthenticatedDevice, DeviceService } from "@services/device.service";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { container } from "tsyringe";

export const DeviceHeaders = {
  API_KEY: "x-api-key",
  PROJECT_ID: "x-project-id",
  FIRMWARE_VERSION: "x-firmware-version",
} as const;

export type ProjectKeyLocals = { project: Project };
export type DeviceLocals = { project: Project; device: AuthenticatedDevice };

function isSameSecret(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

// project key auth (x-project-id + x-api-key), only used to ask for access....
// same 401 for every bad combo so project ids don't leak....
export async function authenticateProjectKey(
  request: Request,
  response: Response<unknown, ProjectKeyLocals>,
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

// device token auth (Authorization: Bearer vdt_...), only approved devices get one....
export async function authenticateDeviceToken(
  request: Request,
  response: Response<unknown, DeviceLocals>,
  next: NextFunction,
): Promise<void> {
  try {
    const header = request.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      throw new ApiError(
        "Device token is required! Register the device first.",
        StatusCodes.UNAUTHORIZED,
      );
    }

    const devices = container.resolve(DeviceService);
    const device = await devices.authenticate(token);
    if (!device) {
      throw new ApiError("Invalid or revoked device token!", StatusCodes.UNAUTHORIZED);
    }

    const project = await ProjectDAL.findProjectByInternalId(device.projectId);
    if (!project) {
      throw new ApiError("Invalid or revoked device token!", StatusCodes.UNAUTHORIZED);
    }

    response.locals.project = project;
    response.locals.device = device;

    await devices.touch(device, {
      firmwareVersion: request.get(DeviceHeaders.FIRMWARE_VERSION)?.trim().slice(0, 32),
    });
    next();
  } catch (error) {
    next(error);
  }
}
