import { db } from "@config/db.config";
import { nanoid } from "nanoid";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Project } from "./project.model";

export type DeviceStatus = "pending" | "active" | "revoked";
export type DeviceChannel = "staging" | "production";

export interface ProjectDeviceDTO {
  id: string;
  hardwareId: string;
  name: string;
  status: DeviceStatus;
  chipModel: string | null;
  firmwareVersion: string | null;
  channel: DeviceChannel | null;
  isClaimed: boolean;
  lastSeenAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export class ProjectDevice extends Model<
  InferAttributes<ProjectDevice>,
  InferCreationAttributes<ProjectDevice>
> {
  declare id: CreationOptional<number>;
  declare public_id: CreationOptional<string>;
  declare project_id_fk: number;
  declare hardware_id: string;
  declare name: string;
  declare status: DeviceStatus;
  declare claim_secret_hash: CreationOptional<string | null>;
  declare token_hash: CreationOptional<string | null>;
  declare chip_model: CreationOptional<string | null>;
  declare firmware_version: CreationOptional<string | null>;
  declare channel: CreationOptional<DeviceChannel | null>;
  declare last_seen_at: CreationOptional<Date | null>;
  declare approved_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  isPending() {
    return this.status === "pending";
  }

  isActive() {
    return this.status === "active";
  }

  isRevoked() {
    return this.status === "revoked";
  }

  toDTO(): ProjectDeviceDTO {
    return {
      id: this.public_id,
      hardwareId: this.hardware_id,
      name: this.name,
      status: this.status,
      chipModel: this.chip_model ?? null,
      firmwareVersion: this.firmware_version ?? null,
      channel: this.channel ?? null,
      isClaimed: Boolean(this.claim_secret_hash),
      lastSeenAt: this.last_seen_at ?? null,
      approvedAt: this.approved_at ?? null,
      createdAt: this.created_at,
    };
  }
}

ProjectDevice.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    public_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    project_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: Project, key: "id" },
      onDelete: "CASCADE",
    },
    hardware_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "active", "revoked"),
      allowNull: false,
      defaultValue: "pending",
    },
    claim_secret_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    chip_model: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    firmware_version: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    channel: {
      type: DataTypes.ENUM("staging", "production"),
      allowNull: true,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize: db,
    modelName: "ProjectDevice",
    tableName: "project_devices",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["project_id_fk", "hardware_id"] }],
  },
);
