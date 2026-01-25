import { NextFunction, Request, Response } from "express";

export function isAuthenticated(request: Request, response: Response, next: NextFunction) {
  if (request.isUnauthenticated()) {
    return response.redirect("/");
  }
  next();
}
