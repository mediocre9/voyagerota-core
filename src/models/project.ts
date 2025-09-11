import { db } from "@config/db";
import { nanoid } from "nanoid";
import { User } from "./user";
import { Board } from "types";
import { generateApiKey } from "@utils/utils";
import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";

export class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  declare id?: string;
  declare project_id?: string;
  declare user_id_fk?: string;
  declare project_name?: string;
  declare api_key?: string;
  declare board_type?: Board;
}

Project.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.STRING,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    user_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    project_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    api_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      defaultValue() {
        return generateApiKey();
      },
    },
    board_type: {
      type: DataTypes.ENUM,
      allowNull: false,
      defaultValue: "ESP32",
      values: ["ESP32", "ESP8266"],
    },
  },
  {
    sequelize: db,
    modelName: "Project",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "projects",
  }
);
