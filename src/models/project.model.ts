import { db } from "@config/db.config";
import { nanoid } from "nanoid";
import { User } from "./user.model";
import { generateApiKey } from "@utils/utils";
import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { Release } from "./release.model";

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id?: number;
  declare public_id?: string;
  declare user_id_fk?: number | null;
  declare project_name?: string;
  declare api_key?: string;
  declare board_type?: "ESP32" | "ESP8266";
  declare Releases?: Release[];
  declare User?: User;
  declare is_suspended?: boolean;
  declare last_activity?: Date | null;
  declare updated_at?: Date | null;
  declare deleted_at?: Date | null;
  declare failure_alert_count?: number;
  declare failure_alert_percent?: number;
  declare auto_revoke?: boolean;

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

  getInitialReleaseChannel() {
    return this.Releases !== undefined && this.Releases.length > 0
      ? this.Releases.at(0)!.getChannel()
      : null;
  }

  hasNoReleases() {
    return this.Releases === undefined || this.Releases.length === 0;
  }

  hasReleases() {
    return this.Releases !== undefined && this.Releases.length > 0;
  }

  isInitialReleaseNonProduction() {
    return (
      this.Releases !== undefined &&
      this.Releases.length > 0 &&
      !this.Releases.at(0)?.isProduction()
    );
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
    is_suspended: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    failure_alert_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 3,
    },
    failure_alert_percent: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 20,
    },
    auto_revoke: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue() {
        return new Date();
      },
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
