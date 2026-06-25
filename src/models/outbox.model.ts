import { db } from "@config/db.config";
import { DataTypes, ENUM, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { Project } from "./project.model";

export enum OutBoxState {
  PROCESSED = "processed",
  PROCESSING = "processing",
  PENDING = "pending",
  FAILED = "failed",
}

export enum OutBoxEvent {
  DELETE = "delete",
  RESTORE = "restore",
}

export class OutBox extends Model<InferAttributes<OutBox>, InferCreationAttributes<OutBox>> {
  declare id?: number;
  declare project_id_fk?: number;
  declare event?: OutBoxEvent;
  declare state?: OutBoxState;

  getId() {
    return this.id!;
  }

  getState() {
    return this.state!;
  }

  getEvent() {
    return this.event!;
  }

  isPending() {
    return this.state === OutBoxState.PENDING;
  }

  isProcessed() {
    return this.state === OutBoxState.PROCESSED;
  }

  isProcessing() {
    return this.state === OutBoxState.PROCESSING;
  }

  isFailed() {
    return this.state === OutBoxState.FAILED;
  }

  getForeignProjectId() {
    return this.project_id_fk!;
  }
}

OutBox.init(
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
    state: {
      type: ENUM("processed", "processing", "pending", "failed"),
      defaultValue: "pending",
      allowNull: true,
    },
    event: {
      type: ENUM("delete", "restore"),
    },
  },
  {
    sequelize: db,
    modelName: "OutBox",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "outbox",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);
