import * as DeviceDAL from "@dal/device.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { DeviceStatus } from "@models/device.model";
import { Project } from "@models/project.model";
import { DeviceDTO, ReleaseIdMacAddressPathParam } from "@schemas/device.schema";
import { ReleaseIdPathParam } from "@schemas/release.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

@injectable()
export class DeviceStatusRegistryService {
  public async update(pathParam: ReleaseIdPathParam, dto: DeviceDTO, project: Project) {
    const { releaseId } = pathParam;
    const { macAddress, status } = dto;

    const release = await this._findProjectRelease(releaseId, project);
    if (!release.isStaging() && !release.isProduction()) {
      throw new ApiError(
        "Device status can only be reported for staging or production releases!",
        StatusCodes.BAD_REQUEST,
      );
    }

    // mac_address is unique across all projects, so never let one project overwrite
    // a device row that belongs to another project....
    const existing = await DeviceDAL.findDeviceByMacAddress(macAddress);
    if (existing) {
      const existingRelease = await ReleaseDAL.getReleaseById(existing.getReleaseForeignKeyId());
      if (existingRelease && existingRelease.getProjectForeignKeyId() !== project.getId()) {
        throw new ApiError(
          `Device (${macAddress}) is registered to another project!`,
          StatusCodes.CONFLICT,
        );
      }
    }

    await DeviceDAL.updateDeviceStatus(release.getId(), macAddress, status);
    const message = this._getStatusMessage(macAddress, release.getVersion(), status);
    Logger.info(message);
    return message;
  }

  public async checkStatus(pathParam: ReleaseIdMacAddressPathParam, project: Project) {
    const { releaseId, macAddress } = pathParam;

    await this._findProjectRelease(releaseId, project);

    const device = await DeviceDAL.findProjectDeviceByMacAddress(project.getId(), macAddress);
    if (!device) {
      throw new ApiError("Device not found!", StatusCodes.NOT_FOUND);
    }

    return device.toDTO();
  }

  private async _findProjectRelease(releaseId: string, project: Project) {
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release || release.getProjectForeignKeyId() !== project.getId()) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }
    return release;
  }

  private _getStatusMessage(macAddress: string, releaseVersion: string, status: DeviceStatus) {
    return status === "success"
      ? `Device: (${macAddress}) successfuly updated with version v${releaseVersion}`
      : `Device: (${macAddress}) update failed for version v${releaseVersion}`;
  }
}
