import z from "zod";

export const ArtifactTaskSchema = z.object(
  {
    releaseId: z.string("releaseId is required!").nonempty("releaseId field is empty!").trim(),
    filename: z.string("filename is required").nonempty("filename field is empty!").trim(),
  },
  { error: "releaseId and filename fields are required!" }
);

export type ArtifactTaskDTO = z.infer<typeof ArtifactTaskSchema>;
