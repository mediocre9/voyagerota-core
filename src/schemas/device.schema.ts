import z from "zod";

const hardwareId = z
  .string("hardwareId is required!")
  .trim()
  .transform((value) => value.replace(/[:\-\s]/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[0-9A-F]{6,32}$/, "hardwareId must be 6 to 32 hex characters (e.g. the chip MAC)!"),
  );

const deviceName = z
  .string()
  .trim()
  .min(1, "name cannot be empty!")
  .max(64, "name can be at most 64 characters!");

export const DeviceRegisterSchema = z.object(
  {
    hardwareId,
    claimSecret: z
      .string("claimSecret is required!")
      .trim()
      .min(16, "claimSecret must be at least 16 characters!")
      .max(128, "claimSecret can be at most 128 characters!"),
    chipModel: z.string().trim().max(64).optional(),
    firmwareVersion: z.string().trim().max(32).optional(),
  },
  { error: "hardwareId and claimSecret are required!" },
);

export const DeviceReportSchema = z.object(
  {
    releaseId: z.string().trim().nonempty().optional(),
    status: z.enum(["success", "failed"], { error: "status can either be success or failed!" }),
    fromVersion: z.string().trim().max(32).optional(),
    toVersion: z.string("toVersion is required!").trim().nonempty().max(32),
    errorCode: z.coerce.number().int().optional(),
    message: z.string().trim().max(255).optional(),
  },
  { error: "status and toVersion are required!" },
);

export const DeviceCreateSchema = z.object(
  {
    hardwareId,
    name: deviceName.optional(),
  },
  { error: "hardwareId is required!" },
);

export const DeviceUpdateSchema = z.object({ name: deviceName }, { error: "name is required!" });

export const DeviceListQuerySchema = z.object({
  status: z.enum(["pending", "active", "revoked"]).optional(),
});

export type DeviceRegisterDTO = z.infer<typeof DeviceRegisterSchema>;
export type DeviceReportDTOInput = z.infer<typeof DeviceReportSchema>;
export type DeviceCreateDTO = z.infer<typeof DeviceCreateSchema>;
export type DeviceUpdateDTO = z.infer<typeof DeviceUpdateSchema>;
export type DeviceListQuery = z.infer<typeof DeviceListQuerySchema>;
