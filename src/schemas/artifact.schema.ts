import z from "zod";

export const ArtifactTaskSchema = z.object(
  {
    releaseId: z.string("releaseId is required").nonempty("releaseId field is empty!").trim(),
    filename: z.string("filename is required").nonempty("filename field is empty!").trim(),
  },
  { error: "releaseId and filename fields are required!" },
);

export const ArtifactIdSchema = z.object(
  {
    artifactId: z
      .string("artifactId query param is required")
      .nonempty("artifactId query paramis missing!")
      .trim(),
  },
  { error: "artifactId and releaseId fields are required!" },
);

export type ArtifactTaskDTO = z.infer<typeof ArtifactTaskSchema>;
export type ArtifactIdDTO = z.infer<typeof ArtifactIdSchema>;
