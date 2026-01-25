import { db } from "@config/db.config";
import { nanoid } from "nanoid";
import { User } from "./user.model";
import { generateApiKey } from "@utils/utils";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Release } from "./release.model";

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id?: number;
  declare public_id?: string;
  declare user_id_fk?: number | null;
  declare project_name?: string;
  declare api_key?: string;
  declare board_type?: "ESP32" | "ESP8266";
  declare deleted_at?: CreationOptional<Date>;
  declare Releases?: Release[];

  getPublicId() {
    return this.getDataValue("public_id")!;
  }

  getUserForeignKey() {
    return this.getDataValue("user_id_fk")!;
  }

  getApiKey() {
    return this.getDataValue("api_key")!;
  }

  getBoardType() {
    return this.getDataValue("board_type")!;
  }

  getId() {
    return this.getDataValue("id")!;
  }

  getDeletedAt() {
    return this.getDataValue("deleted_at");
  }

  getProjectReleases() {
    return this.Releases;
  }

  getProjectName() {
    return this.getDataValue("project_name")!;
  }
}

Project.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    public_id: {
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: "Project",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "projects",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);
