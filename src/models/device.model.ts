import { db } from "@config/db.config";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import { Project } from "./project.model";

export class Device extends Model<InferAttributes<Device>, InferCreationAttributes<Device>> {
  declare id?: number;
  declare project_id_fk?: number;
  declare mac_address: string;
  declare deleted_at: CreationOptional<Date>;
}

Device.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    project_id_fk: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: Project,
        key: "id",
      },
    },
    mac_address: {
      type: DataTypes.STRING,
      unique: true,
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
  }
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
