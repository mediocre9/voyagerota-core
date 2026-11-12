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

// the latest result of each device for each release, rollout stats are computed from this
// so they stay exact while the per device report history is capped....
export class DeviceReleaseOutcome extends Model<
  InferAttributes<DeviceReleaseOutcome>,
  InferCreationAttributes<DeviceReleaseOutcome>
> {
  declare id: CreationOptional<number>;
  declare device_id_fk: number;
  declare release_id_fk: number;
  declare status: "success" | "failed";
  declare error_code: number | null;
  declare message: string | null;
  declare updated_at: CreationOptional<Date>;
  declare created_at: CreationOptional<Date>;
}

DeviceReleaseOutcome.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    device_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: ProjectDevice, key: "id" },
      onDelete: "CASCADE",
    },
    release_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: Release, key: "id" },
      onDelete: "CASCADE",
    },
    status: { type: DataTypes.ENUM("success", "failed"), allowNull: false },
    error_code: { type: DataTypes.INTEGER, allowNull: true },
    message: { type: DataTypes.STRING(255), allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize: db,
    modelName: "DeviceReleaseOutcome",
    tableName: "device_release_outcomes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { unique: true, fields: ["device_id_fk", "release_id_fk"] },
      { fields: ["release_id_fk", "status"] },
    ],
  },
);
