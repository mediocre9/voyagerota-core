import "@models/index";
import * as OutBoxDAL from "@dal/outbox.dal";
import { setInterval } from "node:timers/promises";
import { StorageManagerQueue } from "@queues/storage.manager.queue";
import { Logger } from "@utils/logger";
import { OutBoxState } from "@models/outbox.model";

const DELAY = 2 * 1000; // 2 sec delay.....

try {
  const _storageQueue = new StorageManagerQueue();

  async function outboxRelayService(): Promise<void> {
    for await (const _ of setInterval(DELAY)) {
      const outboxes = await OutBoxDAL.findAllPendingOutBoxes({ limit: 50 });
      for (const outbox of outboxes) {
        await _storageQueue.enQueueFile({
          projectId: outbox.getForeignProjectId(),
          outboxId: outbox.getId(),
          event: outbox.getEvent(),
        });

        await OutBoxDAL.updateOutboxState(outbox.getId(), OutBoxState.PROCESSING);
      }
    }
  }

  await outboxRelayService();
} catch (error) {
  Logger.error((error as Error).message);
}
