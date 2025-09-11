import { db } from "../config/db";
import { User } from "./user";
import { Project } from "./project";
import { Release } from "./release";
import { Device } from "./device";
import { Logger } from "@utils/logger";

Project.belongsTo(User, { foreignKey: "user_id_fk" });
User.hasMany(Project, { foreignKey: "user_id_fk" });

Release.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(Release, { foreignKey: "project_id_fk" });

Device.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(Device, { foreignKey: "project_id_fk" });

try {
  await db.sync();
  Logger.info("Models Synced!");
} catch (error) {
  if (typeof error === "string") {
    Logger.error(error);
  }
}

export { User, Project, Release, Device };
