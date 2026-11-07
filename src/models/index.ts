import { db } from "../config/db.config";
import { isDevEnvironment } from "../config/config";
import { User } from "./user.model";
import { Project } from "./project.model";
import { Release } from "./release.model";
import { Logger } from "@utils/logger";
import { Artifact } from "./artifact.model";
import { Device } from "./device.model";

Project.belongsTo(User, { foreignKey: "user_id_fk" });
User.hasMany(Project, { foreignKey: "user_id_fk" });
Release.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(Release, { foreignKey: "project_id_fk" });
Release.hasMany(Artifact, { foreignKey: "release_id_fk" });
Artifact.belongsTo(Release, { foreignKey: "release_id_fk" });
Device.belongsTo(Release, { foreignKey: "release_id_fk" });
Release.hasMany(Device, { foreignKey: "release_id_fk" });

if (isDevEnvironment()) {
  try {
    await db.sync();
    Logger.info("Models Synced!");
  } catch (error) {
    if (typeof error === "string") {
      Logger.error(error);
    }
    Logger.error((error as Error).message);
  }
} else {
  Logger.info("Skipping db.sync() outside development! Apply schema changes via migrations.");
}

export { User, Project, Release, Artifact as ArtifactFile };
