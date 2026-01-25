import z from "zod";

export const ProjectSchema = z.object(
  {
    userId: z.string("userId is required!").nonempty("userId field is empty!").trim(),
    projectName: z
      .string("projectName is required!")
      .nonempty("projectName field is empty!")
      .trim(),
    boardType: z.enum(["ESP32", "ESP8266"], {
      error: "boardType field is required either with ESP32 or ESP8266!",
    }),
  },
  { error: "userId, projectName and boardType [ESP32 or ESP8266] is required!" }
);

export const ProjectIdQueryParamSchema = z.object({
  projectId: z.string("projectId is required!").nonempty("projectId field is empty!").trim(),
});

export type ProjectIdQueryParam = z.infer<typeof ProjectIdQueryParamSchema>;
export type ProjectDTO = z.infer<typeof ProjectSchema>;
