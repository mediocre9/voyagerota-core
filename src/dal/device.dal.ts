import { Device, DeviceStatus } from "@models/device.model";
import { Release } from "@models/release.model";

export async function updateDeviceStatus(
  releaseId: number,
  macAddress: string,
  status: DeviceStatus,
) {
  await Device.upsert({
    release_id_fk: releaseId,
    mac_address: macAddress,
    status: status,
  });
}

export async function findDeviceByMacAddress(macAddress: string) {
  return await Device.findOne({
    where: { mac_address: macAddress },
    include: { model: Release, required: true, attributes: ["public_id", "version", "channel"] },
  });
}

export async function findProjectDeviceByMacAddress(projectId: number, macAddress: string) {
  return await Device.findOne({
    where: { mac_address: macAddress },
    include: {
      model: Release,
      required: true,
      where: { project_id_fk: projectId },
      attributes: ["public_id", "version", "channel"],
    },
  });
}
