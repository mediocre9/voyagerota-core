import { db } from "@config/db.config";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Release } from "./release.model";
import { nanoid } from "nanoid";

export type DeviceStatus = "success" | "failed" | "unknown";
export class Device extends Model<InferAttributes<Device>, InferCreationAttributes<Device>> {
  declare id?: number;
  declare release_id_fk?: number;
  declare public_id?: string;
  declare status: DeviceStatus;
  declare mac_address: string;
  declare deleted_at?: CreationOptional<Date>;
  declare updated_at?: CreationOptional<Date>;

  getId() {
    return this.getDataValue("id")!;
  }

  getReleaseForeignKeyId() {
    return this.getDataValue("release_id_fk")!;
  }

  getPublicId() {
    return this.getDataValue("public_id")!;
  }

  getMacAddress() {
    return this.getDataValue("mac_address");
  }

  getStatus() {
    return this.getDataValue("status");
  }

  toDTO() {
    return {
      id: this.getPublicId(),
      macAddress: this.getMacAddress(),
      status: this.getStatus(),
    };
  }
}

Device.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    public_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue() {
        return nanoid(21);
      },
    },
    release_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: Release,
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("success", "failed", "unknown"),
      defaultValue: "unknown",
    },
    mac_address: {
      type: DataTypes.STRING,
      unique: true,
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
    modelName: "Device",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "devices",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);

/**
 * @description Reconsider this approach again
 * otherwise drop this table and collect realtime
 * basic teletmetry data for device statuses....
 */
// export class DeviceTelemetry extends Model<
//   InferAttributes<DeviceTelemetry>,
//   InferCreationAttributes<DeviceTelemetry>
// > {
//   declare id?: string;
//   declare release_id_fk?: string;
//   declare free_heap_usage: number;
//   declare rssi: number;
//   declare uptime: string;
// }

// export class DeviceOTAStatus extends Model<
//   InferAttributes<DeviceOTAStatus>,
//   InferCreationAttributes<DeviceOTAStatus>
// > {
//   declare id?: string;
//   declare release_id_fk?: string;
//   declare device_mac_address: string;
//   declare is_successful: boolean;
// }

// DeviceOTAStatus.init(
//   {
//     id: {
//       type: DataTypes.BIGINT.UNSIGNED,
//       primaryKey: true,
//       autoIncrement: true,
//     },
//     release_id_fk: {
//       type: DataTypes.BIGINT.UNSIGNED,
//       allowNull: false,
//       references: {
//         model: Release,
//         key: "id",
//       },
//     },
//     device_mac_address: {
//       type: DataTypes.STRING,
//       unique: true,
//     },
//     is_successful: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//     },
//   },
//   {
//     sequelize: db,
//     modelName: "Device",
//     timestamps: true,
//     createdAt: "created_at",
//     updatedAt: "updated_at",
//     tableName: "devices",
//   },
// );
