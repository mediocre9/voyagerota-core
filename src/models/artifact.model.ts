import { db } from "@config/db.config";
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from "sequelize";
import { Release } from "./release.model";
import { nanoid } from "nanoid";

export interface ArtifactFileDTO {
  id: string;
  size: number;
  filename: string;
  hash: string;
}

export type ArtifactProcessState = "processed" | "pending" | "revoked";
export type ArtifactBuildStatus = "development-build" | "production-build" | "unknown-build";

export class Artifact extends Model<InferAttributes<Artifact>, InferCreationAttributes<Artifact>> {
  declare id?: number;
  declare release_id_fk?: number;
  declare filename?: string;
  declare original_filename?: string;
  declare public_id?: string;
  declare hash?: string;
  declare size?: number;
  declare state?: ArtifactProcessState;
  declare build_status?: ArtifactBuildStatus;
  declare deleted_at?: Date | null;

  getId() {
    return this.getDataValue("id")!;
  }

  getReleaseForeignKeyId() {
    return this.getDataValue("release_id_fk")!;
  }

  getFileSize() {
    return this.getDataValue("size")!;
  }

  getPublicId() {
    return this.getDataValue("public_id")!;
  }

  getFileName() {
    return this.getDataValue("filename")!;
  }

  getOriginalFileName() {
    return this.getDataValue("original_filename");
  }

  getFileProcessState() {
    return this.getDataValue("state")!;
  }

  isProcessed() {
    return this.getDataValue("state")! === "processed";
  }

  isRevoked() {
    return this.getDataValue("state")! === "revoked";
  }

  isPending() {
    return this.getDataValue("state")! === "pending";
  }

  getFileBuildStatus() {
    return this.getDataValue("build_status")!;
  }

  getFileHash() {
    return this.getDataValue("hash")!;
  }

  toDTO(): NonAttribute<ArtifactFileDTO> {
    return {
      id: this.getDataValue("public_id")!,
      filename: this.getDataValue("filename")!,
      hash: this.getDataValue("hash")!,
      size: this.getDataValue("size")!,
    };
  }
}

Artifact.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    release_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      references: {
        key: "id",
        model: Release,
      },
      unique: true,
    },
    original_filename: {
      type: DataTypes.STRING,
    },
    public_id: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.ENUM("processed", "pending", "revoked"),
      defaultValue: "pending",
      allowNull: false,
    },
    build_status: {
      type: DataTypes.ENUM("development-build", "production-build", "unknown-build"),
      defaultValue: "unknown-build",
      allowNull: false,
    },
    hash: { type: DataTypes.STRING, allowNull: true },
    size: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, defaultValue: 0 },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Artifact",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "artifact",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);
