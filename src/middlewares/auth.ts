import { getAuth } from "@clerk/express";
import { isClerkEnabled } from "@config/clerk.config";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Project } from "@models/project.model";
import { Release } from "@models/release.model";
import { User } from "@models/user.model";
import { resolveClerkUser } from "@services/clerk.user.service";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export type UserLocals = { user: User };
export type ProjectLocals = UserLocals & { project: Project };
export type ReleaseLocals = ProjectLocals & { release: Release };

// for the ejs pages (passport session only)....
export function isAuthenticated(request: Request, response: Response, next: NextFunction) {
  if (request.isUnauthenticated()) {
    return response.redirect("/");
  }
  next();
}

// for json apis: accepts the passport session (ejs) or a clerk bearer token (spa)....
export async function requireUser(
  request: Request,
  response: Response<unknown, Partial<UserLocals>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (request.isAuthenticated() && request.user) {
      response.locals.user = request.user as User;
      next();
      return;
    }

    if (isClerkEnabled()) {
      const { userId } = getAuth(request);
      if (userId) {
        response.locals.user = await resolveClerkUser(userId);
        next();
        return;
      }
    }

    throw new ApiError("Authentication required!", StatusCodes.UNAUTHORIZED);
  } catch (error) {
    next(error);
  }
}

// router.param handler for :projectId, the project must belong to the signed in user....
export async function loadOwnedProject(
  _: Request,
  response: Response<unknown, Partial<ProjectLocals>>,
  next: NextFunction,
  projectId: string,
): Promise<void> {
  try {
    const user = response.locals.user;
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    // same 404 for "missing" and "not yours" so project ids don't leak....
    if (!user || !project || project.getUserForeignKey() !== user.getId()) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    response.locals.project = project;
    next();
  } catch (error) {
    next(error);
  }
}

// router.param handler for :releaseId, the release must belong to the loaded project....
export async function loadProjectRelease(
  _: Request,
  response: Response<unknown, Partial<ReleaseLocals>>,
  next: NextFunction,
  releaseId: string,
): Promise<void> {
  try {
    const project = response.locals.project;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);

    if (!project || !release || release.getProjectForeignKeyId() !== project.getId()) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    response.locals.release = release;
    next();
  } catch (error) {
    next(error);
  }
}
