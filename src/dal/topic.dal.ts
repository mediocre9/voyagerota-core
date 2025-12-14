import { Topic } from "@models/topic.model";
import { Nullable } from "@utils/utils";
import { Transaction } from "sequelize";

const MAX_TOPIC_LIMIT_PER_TELEMETRY = 5;

export async function createTopic(telemetryId: number, topic: string): Promise<void> {
  await Topic.create({ telemetry_id_fk: telemetryId, topic: topic });
}

export async function findTopicByTelemetryId(telemetryId: string): Promise<Nullable<Topic>> {
  return await Topic.findOne({ where: { telemetry_id_fk: telemetryId } });
}

export async function updateTopic(
  telemetryId: number,
  topic: string,
  transactionInstance?: Transaction
): Promise<void> {
  await Topic.update(
    { topic: topic },
    { where: { telemetry_id_fk: telemetryId }, transaction: transactionInstance }
  );
}

export async function isTopicLimitReached(telemetryId: number): Promise<boolean> {
  const count = await Topic.count({
    where: {
      telemetry_id_fk: telemetryId,
    },
  });

  const isLimitReached = count >= MAX_TOPIC_LIMIT_PER_TELEMETRY;
  return isLimitReached;
}
