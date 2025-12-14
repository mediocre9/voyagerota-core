import { db } from "@config/db.config";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Project } from "./project.model";
import { nanoid } from "nanoid";

export class Telemetry extends Model<
  InferAttributes<Telemetry>,
  InferCreationAttributes<Telemetry>
> {
  declare id?: number;
  declare public_id?: string;
  declare project_id_fk?: number;
  declare topic?: string;
  declare username?: string;
  declare deleted_at: CreationOptional<Date>;
}

Telemetry.init(
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
    project_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      references: {
        key: "id",
        model: Project,
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Telemetry",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "telemetry",
    paranoid: true,
    deletedAt: "deleted_at",
  }
);
