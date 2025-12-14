import { db } from "@config/db.config";
import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { Telemetry } from "./telemetry.model";
import { nanoid } from "nanoid";

export class Topic extends Model<InferAttributes<Topic>, InferCreationAttributes<Topic>> {
  declare id?: number;
  declare public_id?: string;
  declare topic?: string;
  declare telemetry_id_fk?: number;
}

Topic.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    public_id: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    telemetry_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      references: {
        key: "id",
        model: Telemetry,
      },
    },
    topic: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Topic",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "topics",
    paranoid: true,
    deletedAt: "deleted_at",
  }
);
