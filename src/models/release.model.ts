import { db } from "@config/db.config";
import { nanoid } from "nanoid";
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from "sequelize";
import { ArtifactFile } from "./artifact.model";
import { Project } from "./project.model";

export type ReleaseStatus = "draft" | "staging" | "production";

export interface ArtifactDTO {
  id: string;
  filename: string;
  size: number;
  hash: string;
}

export interface ReleaseAttributesDTO {
  id: string;
  version: string;
  changeLog: string;
  status: ReleaseStatus;
  createdAt: Date;
  releasedAt?: Date | null;
  artifact?: ArtifactDTO;
}

export class Release extends Model<InferAttributes<Release>, InferCreationAttributes<Release>> {
  declare id?: number;
  declare project_id_fk?: number;
  declare public_id?: string;
  declare version: string;
  declare flatten_version?: number;
  declare change_log?: string;
  declare status?: ReleaseStatus;
  declare deleted_at: Date | null;
  declare created_at: Date | null;
  declare released_at: Date | null;
  declare ArtifactFiles?: ArtifactFile[];

  toDTO(): NonAttribute<ReleaseAttributesDTO> {
    return {
      id: this.getDataValue("public_id")!,
      status: this.getDataValue("status")!,
      version: this.getDataValue("version"),
      changeLog: this.getDataValue("change_log")!,
      createdAt: this.getDataValue("created_at")!,
      releasedAt: this.getDataValue("released_at") ?? null,
      artifact:
        this.ArtifactFiles && this.ArtifactFiles[0]
          ? {
              id: this.ArtifactFiles[0].public_id!,
              filename: this.ArtifactFiles[0].filename!,
              size: this.ArtifactFiles[0].size!,
              hash: this.ArtifactFiles[0].hash!,
            }
          : undefined,
    };
  }
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
    public_id: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    version: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flatten_version: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    change_log: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "## What's New",
    },
    status: {
      type: DataTypes.ENUM("draft", "staging", "production"),
      defaultValue: "draft",
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    released_at: {
      type: DataTypes.DATE,
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
    paranoid: true,
    deletedAt: "deleted_at",
  }
);
