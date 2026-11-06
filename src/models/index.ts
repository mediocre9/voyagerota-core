import { db } from "../config/db.config";
import { User } from "./user.model";
import { Project } from "./project.model";
import { Release } from "./release.model";
import { Logger } from "@utils/logger";
import { Artifact } from "./artifact.model";
import { Device } from "./device.model";
import { Telemetry } from "./telemetry.model";
import { Topic } from "./topic.model";

Project.belongsTo(User, { foreignKey: "user_id_fk" });
User.hasMany(Project, { foreignKey: "user_id_fk" });
Release.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(Release, { foreignKey: "project_id_fk" });
Release.hasMany(Artifact, { foreignKey: "release_id_fk" });
Artifact.belongsTo(Release, { foreignKey: "release_id_fk" });
Device.belongsTo(Release, { foreignKey: "release_id_fk" });
Release.hasMany(Device, { foreignKey: "release_id_fk" });
Project.hasOne(Telemetry, { foreignKey: "project_id_fk" });
Telemetry.belongsTo(Project, { foreignKey: "project_id_fk" });
Telemetry.hasMany(Topic, { foreignKey: "telemetry_id_fk" });
Topic.belongsTo(Telemetry, { foreignKey: "telemetry_id_fk" });

try {
  await db.sync();
  Logger.info("Models Synced!");
} catch (error) {
  if (typeof error === "string") {
    Logger.error(error);
  }
  Logger.error((error as Error).message);
}

export { User, Project, Release, Artifact as ArtifactFile, Telemetry, Topic };
