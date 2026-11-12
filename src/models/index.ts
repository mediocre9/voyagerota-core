import { db } from "../config/db.config";
import { User } from "./user.model";
import { Project } from "./project.model";
import { Release } from "./release.model";
import { Logger } from "@utils/logger";
import { Artifact } from "./artifact.model";
import { ProjectDevice } from "./project.device.model";
import { DeviceUpdateReport } from "./device.report.model";
import { DeviceReleaseOutcome } from "./device.outcome.model";

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
DeviceReleaseOutcome.belongsTo(ProjectDevice, { foreignKey: "device_id_fk" });
DeviceReleaseOutcome.belongsTo(Release, { foreignKey: "release_id_fk" });

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

// one time: build outcomes from the reports recorded before the outcomes table existed....
async function backfillReleaseOutcomes(): Promise<void> {
  if ((await DeviceReleaseOutcome.count()) > 0) return;
  await db.query(
    `INSERT IGNORE INTO device_release_outcomes (device_id_fk, release_id_fk, status, error_code, message, created_at, updated_at)
     SELECT r.device_id_fk, r.release_id_fk, r.status, r.error_code, r.message, r.created_at, r.created_at
     FROM device_update_reports r
     WHERE r.release_id_fk IS NOT NULL
       AND r.id = (SELECT MAX(r2.id) FROM device_update_reports r2
                   WHERE r2.device_id_fk = r.device_id_fk AND r2.release_id_fk = r.release_id_fk)`,
  );
}

try {
  await db.sync();
  await addMissingColumns();
  await backfillReleaseOutcomes();
  Logger.info("Models Synced!");
} catch (error) {
  if (typeof error === "string") {
    Logger.error(error);
  }
  Logger.error((error as Error).message);
}

export { User, Project, Release, Artifact as ArtifactFile };
