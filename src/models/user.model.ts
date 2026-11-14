import { db } from "../config/db.config";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { isPlanName, type PlanName } from "@config/plans";
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id?: number;
  declare public_id?: string;
  declare google_id?: string;
  declare username: string;
  declare email: string;
  declare picture_url?: string;
  declare password?: string;
  declare is_revoked?: boolean;
  declare plan: CreationOptional<PlanName>;
  declare trial_ends_at: CreationOptional<Date | null>;
  declare deleted_at: CreationOptional<Date>;

  getId() {
    return this.getDataValue("id")!;
  }

  getPublicId() {
    return this.getDataValue("public_id")!;
  }

  getUsername() {
    return this.getDataValue("username");
  }

  getEmail() {
    return this.getDataValue("email");
  }

  getPassword() {
    return this.getDataValue("password");
  }

  isRevoked() {
    return this.getDataValue("is_revoked");
  }

  // anything that isn't a known plan (older names included) counts as free....
  getPlan(): PlanName {
    const plan = this.getDataValue("plan");
    return plan && isPlanName(plan) ? plan : "free";
  }

  getTrialEndsAt(): Date | null {
    return this.getDataValue("trial_ends_at") ?? null;
  }
}

User.init(
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
    google_id: {
      type: DataTypes.CHAR,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    picture_url: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        min: 8,
      },
    },
    is_revoked: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    plan: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "free",
    },
    trial_ends_at: {
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
    modelName: "User",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "users",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);

User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});
