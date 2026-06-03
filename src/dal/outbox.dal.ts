import { OutBoxEvent, OutBox, OutBoxState } from "@models/outbox.model";
import { Op, Transaction } from "sequelize";

type OutBoxData = {
  projectId: number;
  state: OutBoxState;
  event: OutBoxEvent;
  transaction?: Transaction;
};
export async function createOutbox({ projectId, event, state, transaction }: OutBoxData) {
  await OutBox.create(
    { project_id_fk: projectId, state: state, event: event },
    { transaction: transaction },
  );
}

export async function updateOutboxState(id: number, state: OutBoxState, transaction?: Transaction) {
  await OutBox.update({ state: state }, { where: { id: id }, transaction: transaction });
}

export async function findAllPendingOutBoxes({ limit }: { limit: number }) {
  return await OutBox.findAll({
    where: {
      [Op.and]: [{ state: "pending" }],
    },
    limit: limit,
  });
}

export async function findAllPendingToRestore(state: OutBoxState, limit: number) {
  return await OutBox.findAll({
    where: { [Op.and]: [{ state: state }, { event: "restore" }] },
    limit: limit,
  });
}

export async function findByOutboxId(id: number, state: OutBoxState) {
  return await OutBox.findOne({
    where: { [Op.and]: [{ state: state }, { id: id }] },
  });
}
