import { db } from "@config/db.config";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { ProjectDevice } from "./project.device.model";
import { Release } from "./release.model";

export type DeviceReportStatus = "success" | "failed";

export interface DeviceReportDTO {
  status: DeviceReportStatus;
  fromVersion: string | null;
  toVersion: string;
  errorCode: number | null;
  message: string | null;
  releaseId: string | null;
  createdAt: Date;
}

export class DeviceUpdateReport extends Model<
  InferAttributes<DeviceUpdateReport>,
  InferCreationAttributes<DeviceUpdateReport>
> {
  declare id: CreationOptional<number>;
  declare device_id_fk: number;
  declare release_id_fk: number | null;
  declare status: DeviceReportStatus;
  declare from_version: string | null;
  declare to_version: string;
  declare error_code: number | null;
  declare message: string | null;
  declare created_at: CreationOptional<Date>;

  declare Release?: Release;

  toDTO(): DeviceReportDTO {
    return {
      status: this.status,
      fromVersion: this.from_version,
      toVersion: this.to_version,
      errorCode: this.error_code,
      message: this.message,
      releaseId: this.Release?.public_id ?? null,
      createdAt: this.created_at,
    };
  }
}

DeviceUpdateReport.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    device_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: ProjectDevice, key: "id" },
      onDelete: "CASCADE",
    },
    release_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: Release, key: "id" },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.ENUM("success", "failed"),
      allowNull: false,
    },
    from_version: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    to_version: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    error_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    message: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize: db,
    modelName: "DeviceUpdateReport",
    tableName: "device_update_reports",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [{ fields: ["device_id_fk", "created_at"] }, { fields: ["release_id_fk"] }],
  },
);
