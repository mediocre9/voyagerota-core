import { Session } from "express-session";
import { z } from "zod";
import { Request } from "express";
import passport from "passport";

export interface VoyagerRequest<
  TRequest = undefined,
  TResponse = undefined,
  TBody = undefined,
  TQueryParams = undefined
> extends Request<TRequest, TResponse, TBody, TQueryParams> {
  session: Session & {
    user?: UserBaseDTO;
    passport?: passport.SessionStrategy & {
      user?: UserGoogleOAuthDTO;
    };
  };
}

export type Nullable<T> = T | null;

export type NullableOrUndefined<T> = T | null | undefined;

export const DeviceSchema = z.object({
  project_id: z
    .string({
      error: (issue) => {
        if (issue.code === "invalid_type") {
          return "project_id is required";
        }
        return "Invalid project_id format";
      },
    })
    .min(1, { message: "project_id cannot be empty" })
    .regex(/^[a-zA-Z0-9_-]{21}$/, { message: "Invalid project_id format" }),

  mac_address: z
    .string({
      error: (issue) => {
        if (issue.code === "invalid_type") {
          return "mac_address is required";
        }
        return "Invalid MAC-Address format";
      },
    })
    .min(1, { message: "mac_address cannot be empty" })
    .regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/, { message: "Invalid MAC-Address format" }),
});

export const UserBaseSchema = z.object({
  publicID: z.nanoid("invalid user_id format!"),
  email: z.email(),
  username: z.string(),
});

export const UserSignUpSchema = z.object({
  email: z.email(),
  username: z.string(),
  password: z.string("Password length should be 8 characters long!").min(8),
});

export const UserLoginSchema = z.object({
  email: z.email(),
  password: z.string("Password length should be 8 characters long!").min(8),
});

export const UserGoogleOAuthSchema = z.object({
  email: z.email(),
  publicID: z.nanoid("invalid user_id format!"),
  username: z.string(),
  googleID: z.string(),
});

export const UserVerificationOtpSchema = z.object({
  email: z.email(),
  username: z.string(),
  code: z.string().min(6).max(6),
});

export type Board = { type: "ESP32" | "ESP8266" };

export const ProjectSchema = z.object({
  projectName: z.string(),
  boardType: z
    .object({
      type: z.enum(["ESP32", "ESP8266"]),
    })
    .default({ type: "ESP32" }),
});

export const ReleaseSchema = z.object({
  projectId: z.nanoid("invalid project_id format!"),
  version: z.string("version is required"),
  filename: z.string().optional(),
  changeLog: z.string().optional().default("What's New"),
});

export type ProjectDTO = z.infer<typeof ProjectSchema>;
export type DeviceDTO = z.infer<typeof DeviceSchema>;
export type ReleaseDTO = z.infer<typeof ReleaseSchema>;
export type UserBaseDTO = z.infer<typeof UserBaseSchema>;
export type UserSignUpDTO = z.infer<typeof UserSignUpSchema>;
export type UserLoginDTO = z.infer<typeof UserLoginSchema>;
export type UserGoogleOAuthDTO = z.infer<typeof UserGoogleOAuthSchema>;
export type UserVerificationOtpDTO = z.infer<typeof UserVerificationOtpSchema>;
