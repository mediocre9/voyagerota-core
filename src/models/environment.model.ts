import { db } from "@config/db.config";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Release } from "./release.model";

export type EnvironmentStatus = "STAGING" | "PRODUCTION";

export class Environment extends Model<
  InferAttributes<Environment>,
  InferCreationAttributes<Environment>
> {
  declare id?: number;
  declare release_id_fk?: number;
  declare status?: EnvironmentStatus;
  declare deleted_at: CreationOptional<Date>;
}

Environment.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    release_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      references: {
        key: "id",
        model: Release,
      },
    },
    status: { type: DataTypes.STRING, defaultValue: "STAGING" },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Environment",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "release_environment",
    paranoid: true,
    deletedAt: "deleted_at",
  }
);
