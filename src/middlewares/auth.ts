import * as ProjectDAL from "@dal/project.dal";
import { User } from "@models/user.model";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export function isAuthenticated(request: Request, response: Response, next: NextFunction) {
  if (request.isUnauthenticated()) {
    return response.redirect("/");
  }
  next();
}

export function getSessionUser<P, ResBody, ReqBody, ReqQuery>(
  request: Request<P, ResBody, ReqBody, ReqQuery>,
): User | undefined {
  return request.user as User | undefined;
}

export function requireSessionUser<P, ResBody, ReqBody, ReqQuery>(
  request: Request<P, ResBody, ReqBody, ReqQuery>,
): User {
  const user = getSessionUser(request);
  if (!user) {
    throw new ApiError("Authentication required!", StatusCodes.UNAUTHORIZED);
  }
  return user;
}

export async function isProjectOwner(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireSessionUser(request);

    const projectId = request.params.projectId;
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new ApiError("projectId path parameter is required!", StatusCodes.BAD_REQUEST);
    }

    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    if (project.getUserForeignKey() !== user.getId()) {
      throw new ApiError("You do not have access to this project!", StatusCodes.FORBIDDEN);
    }

    next();
  } catch (error) {
    next(error);
  }
}
