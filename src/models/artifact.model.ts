import { db } from "@config/db.config";
import {
  CreationOptional,
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

export class ArtifactFile extends Model<
  InferAttributes<ArtifactFile>,
  InferCreationAttributes<ArtifactFile>
> {
  declare id?: number;
  declare release_id_fk?: number;
  declare filename?: string;
  declare public_id?: string;
  declare hash?: string;
  declare size?: number;
  declare deleted_at: CreationOptional<Date>;

  toDTO(): NonAttribute<ArtifactFileDTO> {
    return {
      id: this.getDataValue("public_id")!,
      filename: this.getDataValue("filename")!,
      hash: this.getDataValue("hash")!,
      size: this.getDataValue("size")!,
    };
  }
}

ArtifactFile.init(
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
    hash: { type: DataTypes.STRING, allowNull: true },
    size: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, defaultValue: 0 },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "ArtifactFile",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "artifact_file",
    paranoid: true,
    deletedAt: "deleted_at",
  }
);
