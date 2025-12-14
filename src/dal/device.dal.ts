import { Device } from "@models/device.model";
import { Op } from "sequelize";

export async function registerDevice(projectId: number, macAddress: string): Promise<void> {
  await Device.create({ project_id_fk: projectId, mac_address: macAddress });
}

export async function isDeviceRegistered(projectId: number, macAddress: string): Promise<boolean> {
  const device = await Device.findOne({
    where: { [Op.and]: { mac_address: macAddress, project_id_fk: projectId } },
  });

  return device !== null;
}

export async function removeDevice(
  projectId: number,
  macAddress: string,
  forceDelete: boolean = false
): Promise<boolean> {
  const removedNumOfRows = await Device.destroy({
    where: { [Op.and]: { project_id_fk: projectId, mac_address: macAddress } },
    force: forceDelete,
  });

  return removedNumOfRows > 0;
}

export async function paginateDevicesList(
  projectId: number,
  offset: number = 0
): Promise<readonly Device[]> {
  const devices = await Device.findAll({
    where: {
      project_id_fk: projectId,
    },
    limit: 5,
    offset: offset,
  });

  return devices;
}
