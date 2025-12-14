import * as uuid from "uuid";
import * as DeviceDAL from "@dal/device.dal";
import * as ProjectDAL from "@dal/project.dal";
import { Logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import { DeviceDTO, DeviceSchema, NullableOrUndefined } from "schemas";
import { ApiError } from "@utils/error";
import { measurePerfomanceAsync } from "@utils/performance";

export class DeviceRegistryService {
  public async registerDevice(payload: DeviceDTO): Promise<void> {
    const { projectId, macAddress } = await DeviceSchema.parseAsync(payload);

    const millis = await measurePerfomanceAsync(async () => {
      const id = await this._getInternalProjectId(projectId);
      const isRegistered = await DeviceDAL.isDeviceRegistered(id!, macAddress);
      if (isRegistered) {
        throw new ApiError(
          `Device MAC (${macAddress}) is already registered!`,
          StatusCodes.CONFLICT,
          uuid.v4()
        );
      }

      await DeviceDAL.registerDevice(id!, macAddress);
    });

    Logger.info(`Device has been registered successfully in ${millis / 1000} seconds!`);
  }

  public async removeDevice(payload: DeviceDTO): Promise<void> {
    const { projectId, macAddress } = await DeviceSchema.parseAsync(payload);
    const id = await this._getInternalProjectId(projectId);

    const isRemoved = await DeviceDAL.removeDevice(id!, macAddress);
    if (!isRemoved) {
      throw new ApiError("Failed to remove the resource!", StatusCodes.BAD_REQUEST, uuid.v4());
    }

    Logger.info("Resource removed successfully!");
  }

  public async authenticate(payload: DeviceDTO): Promise<void> {
    const { projectId, macAddress } = await DeviceSchema.parseAsync(payload);
    const id = await this._getInternalProjectId(projectId);

    const isRegistered = await DeviceDAL.isDeviceRegistered(id!, macAddress);
    if (!isRegistered) {
      throw new ApiError("Device is not registered!", StatusCodes.UNAUTHORIZED, uuid.v4());
    }

    Logger.info("Device Authenticated!");
  }

  private async _getInternalProjectId(projectId: string): Promise<NullableOrUndefined<number>> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    return project.id;
  }
}
