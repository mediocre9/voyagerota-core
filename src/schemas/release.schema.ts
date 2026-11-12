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
  { error: "releaseId and artifactId path parameter are required!" },
);

export const ReleaseSchema = z.object({
  version: z.string("version is required!").nonempty("version field is empty!").trim(),
  changelog: z
    .string()
    .trim()
    .max(10000, "Changelog can be at most 10,000 characters!")
    .optional()
    .default("What's New"),
});

export const ReleaseIdSchema = z.object(
  {
    releaseId: z
      .string({ error: "releaseId is required!" })
      .nonempty({ error: "releaseId is empty!" }),
  },
  { error: "releaseId is required!" },
);

export const ReleaseIdQueryParamSchema = z.object({
  releaseId: z
    .string("releaseId query parameter is required!")
    .nonempty("releaseId query parameter is empty!"),
});

export const ReleaseIdPathParamSchema = z.object({
  releaseId: z
    .string("releaseId path parameter is required!")
    .nonempty("releaseId path parameter is empty!"),
});

export const ReleaseBaseQueryParamSchema = z.object({
  limit: z.coerce.number().default(5).optional(),
  offset: z.coerce.number().default(0).optional(),
  channel: z
    .enum(["all", "draft", "staging", "production"], {
      error: "allowed channel query params are [all, draft, staging, production]!",
    })
    .optional()
    .nullable(),
});

export const ReleaseChannelQueryParamSchema = z.object({
  channel: z.enum(["staging", "production"], {
    error: "allowed channel query params are [staging, production]!",
  }),
});

export const ChangelogSchema = z.object(
  {
    changelog: z
      .string("changelog is required!")
      .trim()
      .max(10000, "Changelog can be at most 10,000 characters!"),
  },
  { error: "changelog is required!" },
);

export const PromotionGuardSchema = z.object(
  {
    confirmVersion: z.string("Type the release version to confirm the promotion.").trim(),
    force: z.boolean().optional(),
  },
  { error: "Type the release version to confirm the promotion." },
);

export const RolloutSettingsSchema = z
  .object({
    failureAlertCount: z.coerce.number().int().min(1).max(1000).optional(),
    failureAlertPercent: z.coerce.number().int().min(1).max(100).optional(),
    autoRevoke: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { error: "Nothing to update!" });

export type ReleaseDTO = z.infer<typeof ReleaseSchema>;
export type ChangelogDTO = z.infer<typeof ChangelogSchema>;
export type PromotionGuardDTO = z.infer<typeof PromotionGuardSchema>;
export type RolloutSettingsDTO = z.infer<typeof RolloutSettingsSchema>;
export type ReleaseArtifactIdPathParams = z.infer<typeof ReleaseArtifactIdPathParamsSchema>;
export type ReleaseIdPathParam = z.infer<typeof ReleaseIdPathParamSchema>;
export type ReleaseIdDTO = z.infer<typeof ReleaseIdSchema>;
export type ReleaseIdQueryParam = z.infer<typeof ReleaseIdQueryParamSchema>;
export type ReleaseBaseQueryParam = z.infer<typeof ReleaseBaseQueryParamSchema>;
export type ReleaseChannelQueryParam = z.infer<typeof ReleaseChannelQueryParamSchema>;
