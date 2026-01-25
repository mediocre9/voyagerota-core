import z from "zod";

export const ReleaseArtifactIdPathParamsSchema = z.object(
  {
    releaseId: z
      .string("releaseId path parameter is required!")
      .nonempty("releaseId path parameter is empty!")
      .trim(),
    artifactId: z
      .string("artifactId path parameter is required!")
      .nonempty("artifactId path parameter is empty!")
      .trim(),
  },
  { error: "releaseId and artifactId path parameter are required!" }
);
export const ReleaseSchema = z.object({
  projectId: z.string("projectId is required!").nonempty("projectId field is empty!").trim(),
  version: z.string("version is required!").nonempty("version field is empty!").trim(),
  changelog: z.string().trim().optional().default("What's New"),
});

export const ReleaseStatusUpdateSchema = z.object(
  {
    releaseId: z
      .string({ error: "releaseId is required!" })
      .nonempty({ error: "releaseId is empty!" }),

    status: z.enum(["staging", "production"], {
      error: "Either staging or production environment status is allowed!",
    }),
  },
  { error: "releaseId and status is required!" }
);

export const ReleaseIdQueryParamSchema = z.object({
  id: z
    .string("releaseId query parameter is required!")
    .nonempty("releaseId query parameter is empty!"),
});

export const ReleaseIdPathParamSchema = z.object({
  releaseId: z
    .string("releaseId path parameter is required!")
    .nonempty("releaseId path parameter is empty!"),
});

export const ReleaseBaseQueryParamSchema = z.object({
  projectId: z
    .string("projectId query parameter is required!")
    .nonempty("projectId query parameter is empty!"),
  limit: z.coerce.number().default(5).optional(),
  offset: z.coerce.number().default(0).optional(),
  status: z
    .enum(["all", "draft", "staging", "production"], {
      error: "allowed status query params are  [all, draft, staging, production]!",
    })
    .optional()
    .nullable(),
});

export const ReleaseStatusQueryParamSchema = ReleaseBaseQueryParamSchema.extend({
  status: z.enum(["staging", "production"], {
    error: "allowed status query params are [staging, production]!",
  }),
});

export type ReleaseDTO = z.infer<typeof ReleaseSchema>;
export type ReleaseArtifactIdPathParams = z.infer<typeof ReleaseArtifactIdPathParamsSchema>;
export type ReleaseIdPathParam = z.infer<typeof ReleaseIdPathParamSchema>;
export type ReleaseStatusUpdateDTO = z.infer<typeof ReleaseStatusUpdateSchema>;
export type ReleaseIdQueryParam = z.infer<typeof ReleaseIdQueryParamSchema>;
export type ReleaseBaseQueryParam = z.infer<typeof ReleaseBaseQueryParamSchema>;
export type ReleaseStatusQueryParam = z.infer<typeof ReleaseStatusQueryParamSchema>;
