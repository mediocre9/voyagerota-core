// every queue worker and the outbox relay in one process, small servers can't spare one each....
import "@models/index";
import "reflect-metadata";
import "./queues/artifact.queue.worker";
import "./queues/email.queue.worker";
import "./queues/storage.manager.queue.worker";
import { Logger } from "@utils/logger";

Logger.info("Workers started: artifact, email, storage");

// the relay loops forever, so it's loaded without waiting on it....
void import("./services/outbox.relay.service");
