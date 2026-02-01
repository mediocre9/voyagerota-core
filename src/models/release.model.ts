import { db } from "@config/db.config";
import { nanoid } from "nanoid";
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from "sequelize";
import { Artifact } from "./artifact.model";
import { Project } from "./project.model";

export type ReleaseChannel = "draft" | "staging" | "production" | "revoked";

export interface ArtifactDTO {
  id: string;
  filename: string;
  size: number;
  prettySize?: string;
  hash: string;
}

export interface ReleaseAttributesDTO {
  id: string;
  version: string;
  changeLog: string;
  channel: ReleaseChannel;
  createdAt?: Date | null;
  releasedAt?: Date | null;
  artifact?: ArtifactDTO;
}

export class Release extends Model<InferAttributes<Release>, InferCreationAttributes<Release>> {
  declare id?: number;
  declare project_id_fk?: number;
  declare public_id?: string;
  declare version?: string;
  declare flatten_version?: number;
  declare change_log?: string;
  declare channel?: ReleaseChannel;
  declare deleted_at: Date | null;
  declare created_at: Date | null;
  declare released_at: Date | null;
  declare Artifacts?: Artifact[];

  getId() {
    return this.getDataValue("id")!;
  }

  getProjectForeignKeyId() {
    return this.getDataValue("project_id_fk")!;
  }

  getVersion() {
    return this.getDataValue("version")!;
  }

  getFlattenedVersion() {
    return this.getDataValue("flatten_version")!;
  }

  getChannel() {
    return this.getDataValue("channel")!;
  }

  isDraft() {
    return this.getDataValue("channel")! === "draft";
  }

  isProduction() {
    return this.getDataValue("channel")! === "production";
  }

  isRevoked() {
    return this.getDataValue("channel")! === "revoked";
  }

  isStaging() {
    return this.getDataValue("channel")! === "staging";
  }

  getPublicId() {
    return this.getDataValue("public_id")!;
  }

  getChangeLog() {
    return this.getDataValue("change_log")!;
  }

  getReleaseArtifacts() {
    return this.getDataValue("Artifacts");
  }

  toDTO(): NonAttribute<ReleaseAttributesDTO> {
    return {
      id: this.getDataValue("public_id")!,
      channel: this.getDataValue("channel")!,
      version: this.getDataValue("version")!,
      changeLog: this.getDataValue("change_log")!,
      createdAt: this.getDataValue("created_at")!,
      releasedAt: this.getDataValue("released_at") ?? null,
      artifact:
        this.Artifacts && this.Artifacts[0]
          ? {
              id: this.Artifacts[0].public_id!,
              filename: this.Artifacts[0].original_filename!,
              size: this.Artifacts[0].size!,
              hash: this.Artifacts[0].hash!,
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
    channel: {
      type: DataTypes.ENUM("draft", "staging", "production", "revoked"),
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
  },
);
