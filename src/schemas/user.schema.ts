import z from "zod";

export const UserBaseSchema = z.object({
  publicId: z.nanoid("invalid user_id format!"),
  email: z.email(),
  username: z.string().trim(),
});

export const UserSignUpSchema = z.object({
  email: z.email(),
  username: z.string().trim(),
  password: z.string("Password length should be 8 characters long!").min(8),
});

export const UserLoginSchema = z.object({
  email: z.email(),
  password: z.string("Password length should be 8 characters long!").min(8),
});

export const UserGoogleOAuthSchema = z.object({
  email: z.email(),
  publicID: z.nanoid("invalid user_id format!"),
  username: z.string().trim(),
  googleID: z.string().trim(),
});

export const UserVerificationOtpSchema = z.object({
  email: z.email(),
  username: z.string().trim(),
  code: z.string().trim().min(6).max(6),
});

export const UserIdQueryParamSchema = z.object({
  userId: z
    .string("userId query parameter is required!")
    .nonempty("userId query parameter is empty!")
    .trim(),
});

export type UserIdQueryParam = z.infer<typeof UserIdQueryParamSchema>;
export type UserBaseDTO = z.infer<typeof UserBaseSchema>;
export type UserSignUpDTO = z.infer<typeof UserSignUpSchema>;
export type UserLoginDTO = z.infer<typeof UserLoginSchema>;
export type UserGoogleOAuthDTO = z.infer<typeof UserGoogleOAuthSchema>;
export type UserVerificationOtpDTO = z.infer<typeof UserVerificationOtpSchema>;
