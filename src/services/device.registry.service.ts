import * as DeviceDAL from "@dal/device.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { DeviceStatus } from "@models/device.model";
import { DeviceDTO, ReleaseIdMacAddressPathParam } from "@schemas/device.schema";
import { ReleaseIdPathParam } from "@schemas/release.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

@injectable()
export class DeviceStatusRegistryService {
  public async update(pathParam: ReleaseIdPathParam, dto: DeviceDTO) {
    const { releaseId } = pathParam;
    const { macAddress, status } = dto;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    await DeviceDAL.updateDeviceStatus(release.getId(), macAddress, status);
    const message = this._getStatusMessage(macAddress, release.getVersion(), status);
    Logger.info(message);
    return message;
  }

  public async checkStatus(pathParam: ReleaseIdMacAddressPathParam) {
    const { releaseId, macAddress } = pathParam;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    const device = await DeviceDAL.findDeviceByMacAddress(macAddress);
    if (!device) {
      throw new ApiError("Device not found!", StatusCodes.NOT_FOUND);
    }

    return device.toDTO();
  }

  private _getStatusMessage(macAddress: string, releaseVersion: string, status: DeviceStatus) {
    return status === "success"
      ? `Device: (${macAddress}) successfuly updated with version v${releaseVersion}`
      : `Device: (${macAddress}) update failed for version v${releaseVersion}`;
  }
}
