import { z } from "zod";

export const TaskIdPathParamSchema = z.object(
  {
    taskId: z
      .string("task id path param is required")
      .nonempty("task id path param is missing!")
      .trim(),
  },
  { error: "task id path param is missing!" },
);

export type TaskIdPathParam = z.infer<typeof TaskIdPathParamSchema>;
