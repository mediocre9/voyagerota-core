import { db } from "../config/db.config";
import { User } from "./user.model";
import { Project } from "./project.model";
import { Release } from "./release.model";
import { Logger } from "@utils/logger";
import { Artifact } from "./artifact.model";
import { ProjectDevice } from "./project.device.model";
import { DeviceUpdateReport } from "./device.report.model";

Project.belongsTo(User, { foreignKey: "user_id_fk" });
User.hasMany(Project, { foreignKey: "user_id_fk" });
Release.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(Release, { foreignKey: "project_id_fk" });
Release.hasMany(Artifact, { foreignKey: "release_id_fk" });
Artifact.belongsTo(Release, { foreignKey: "release_id_fk" });
ProjectDevice.belongsTo(Project, { foreignKey: "project_id_fk" });
Project.hasMany(ProjectDevice, { foreignKey: "project_id_fk" });
DeviceUpdateReport.belongsTo(ProjectDevice, { foreignKey: "device_id_fk" });
ProjectDevice.hasMany(DeviceUpdateReport, { foreignKey: "device_id_fk" });
DeviceUpdateReport.belongsTo(Release, { foreignKey: "release_id_fk" });

// db.sync() only creates missing tables, so add columns that were introduced after a table
// was created. additive only: never drops, renames or alters existing columns....
async function addMissingColumns(): Promise<void> {
  const queryInterface = db.getQueryInterface();
  for (const model of Object.values(db.models)) {
    const tableName = model.getTableName();
    const table = typeof tableName === "string" ? tableName : tableName.tableName;
    const existing = await queryInterface.describeTable(table);
    for (const [name, attribute] of Object.entries(model.getAttributes())) {
      const column = attribute.field ?? name;
      if (column in existing) continue;
      const { type, allowNull, defaultValue } = attribute;
      // a NOT NULL column without a default can't be added to a table that already has rows....
      const safeAllowNull = allowNull === false && defaultValue === undefined ? true : allowNull;
      await queryInterface.addColumn(table, column, {
        type,
        allowNull: safeAllowNull,
        defaultValue: typeof defaultValue === "function" ? undefined : defaultValue,
      });
      Logger.warn(`Added missing column ${table}.${column}`);
    }
  }
}

try {
  await db.sync();
  await addMissingColumns();
  Logger.info("Models Synced!");
} catch (error) {
  if (typeof error === "string") {
    Logger.error(error);
  }
  Logger.error((error as Error).message);
}

export { User, Project, Release, Artifact as ArtifactFile };
