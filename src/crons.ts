// every cron in one process, each one still takes its own redis lock before running....
import "@models/index";
import "reflect-metadata";
import "./cron/dormant.project.cron";
import "./cron/purge.projects.cron";
import "./cron/orphan.file.cleaner.cron";
import "./cron/service.status.alert.cron";
import { Logger } from "@utils/logger";

Logger.info("Crons started: dormant, purge, orphan, service alert");
