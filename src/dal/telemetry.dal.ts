import { Telemetry } from "@models/telemetry.model";
import { Nullable } from "../types";

import { Op, Transaction } from "sequelize";

export async function createTopic(projectId: number, topic: string): Promise<void> {
  await Telemetry.create({ topic: topic, project_id_fk: projectId });
}

export async function isTopicLimitReached(projectId: string): Promise<boolean> {
  const count = await Telemetry.count({
    where: {
      project_id_fk: projectId,
    },
  });

  const isLimitReached = count >= 5;
  return isLimitReached;
}

export async function updateTopic(
  projectId: string,
  topic: string,
  transactionInstance?: Transaction,
): Promise<void> {
  await Telemetry.update(
    { topic: topic },
    { where: { project_id_fk: projectId }, transaction: transactionInstance },
  );
}

export async function enableTelemetry(projectId: number, username: string): Promise<Telemetry> {
  return await Telemetry.create({
    username: username,
    project_id_fk: projectId,
  });
}

export async function deleteTelemetry(
  projectId: number,
  transactionObject?: Transaction,
): Promise<void> {
  await Telemetry.destroy({
    where: {
      project_id_fk: projectId,
    },
    transaction: transactionObject,
    force: false,
  });
}

export async function purgeAllTelemetry(
  date: Date,
  transactionObject?: Transaction,
): Promise<void> {
  await Telemetry.destroy({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    transaction: transactionObject,
    force: true,
  });
}

export async function getSoftDeletedTelemetry(date: Date): Promise<readonly Telemetry[]> {
  return await Telemetry.findAll({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    paranoid: false,
  });
}

export async function isUsernameAvailable(projectId: number): Promise<Nullable<Telemetry>> {
  return await Telemetry.findOne({
    where: {
      project_id_fk: projectId,
    },
  });
}

export async function isTelemetryEnabled(projectId: number): Promise<Nullable<Telemetry>> {
  return await Telemetry.findOne({
    where: {
      project_id_fk: projectId,
    },
  });
}
