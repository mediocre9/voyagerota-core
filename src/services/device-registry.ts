import * as uuid from "uuid";
import * as DeviceDAL from "@dal/device";
import * as ProjectDAL from "@dal/project";
import { Logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import { DeviceDTO, DeviceSchema, NullableOrUndefined } from "types";
import { ApiError, ResourceNotFoundError } from "@utils/error";
import { measurePerfomanceAsAsync } from "@utils/performance";

export class DeviceRegistryService {
  public async registerDevice(payload: DeviceDTO): Promise<void> {
    const { project_id, mac_address } = await DeviceSchema.parseAsync(payload);

    const millis = await measurePerfomanceAsAsync(async () => {
      const id = await this.getInternalProjectId(project_id);
      const isRegistered = await DeviceDAL.isDeviceRegistered(id!, mac_address);
      if (isRegistered) {
        throw new ApiError(
          `Device MAC (${mac_address}) is already registered!`,
          StatusCodes.CONFLICT,
          uuid.v4()
        );
      }

      await DeviceDAL.registerDevice(id!, mac_address);
    });

    Logger.info(`Device has been registered successfully in ${millis / 1000} seconds!`);
  }

  public async removeDevice(payload: DeviceDTO): Promise<void> {
    const { project_id, mac_address } = await DeviceSchema.parseAsync(payload);
    const id = await this.getInternalProjectId(project_id);

    const isRemoved = await DeviceDAL.removeDevice(id!, mac_address);
    if (!isRemoved) {
      throw new ApiError("Failed to remove the resource", StatusCodes.OK, uuid.v4());
    }

    Logger.info("Resource removed successfully!");
  }

  public async authenticate(payload: DeviceDTO): Promise<void> {
    const { project_id, mac_address } = await DeviceSchema.parseAsync(payload);
    const id = await this.getInternalProjectId(project_id);

    const isRegistered = await DeviceDAL.isDeviceRegistered(id!, mac_address);
    if (!isRegistered) {
      throw new ApiError(
        "Device is not registered!",
        StatusCodes.UNAUTHORIZED,
        uuid.v4()
      );
    }

    Logger.info("Device Authenticated!");
  }

  private async getInternalProjectId(
    projectId: string
  ): Promise<NullableOrUndefined<string>> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ResourceNotFoundError("Project not found", StatusCodes.NOT_FOUND);
    }

    return project.id;
  }
}

await new DeviceRegistryService().registerDevice({
  project_id: "NAij6ucv92vgd4NBZi9Im",
  mac_address: "B0:47:D9:50:56:FA",
});
