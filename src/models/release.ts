import { db } from "@config/db";
import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { Project } from "./project";
import { nanoid } from "nanoid";

export class Release extends Model<
  InferAttributes<Release>,
  InferCreationAttributes<Release>
> {
  declare id?: string;
  declare project_id_fk?: string;
  declare release_id?: string;
  declare version: string;
  declare flatten_version?: number;
  declare file_size?: number;
  declare change_log?: string;
  declare firmware_hash?: string;
}

Release.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    project_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      references: {
        key: "id",
        model: Project,
      },
    },
    release_id: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    file_size: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    },
    version: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    flatten_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      unique: true,
      allowNull: true,
    },
    change_log: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    firmware_hash: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Release",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "releases",
  },
);
