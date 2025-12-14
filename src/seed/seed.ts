import { db } from "@config/db.config";
import { Project } from "@models/project.model";
import { Release } from "@models/release.model";
import { User } from "@models/user.model";
import { generateApiKey, getNormalizedVersion } from "@utils/utils";
import { nanoid } from "nanoid";
import { Logger } from "@utils/logger";
import { log } from "console";

const transaction = await db.transaction();
try {
  await User.bulkCreate(
    [
      {
        id: 1,
        username: "Mediocre9",
        public_id: nanoid(21),
        email: "mediocre9@gmail.com",
      },
      { id: 2, username: "Shelly", public_id: nanoid(21), email: "shelly@brawl.example" },
      { id: 3, username: "Colt", public_id: nanoid(21), email: "colt@brawl.example" },
      { id: 4, username: "Brock", public_id: nanoid(21), email: "brock@brawl.example" },
    ],
    { transaction: transaction }
  );

  await Project.bulkCreate(
    [
      {
        id: 1,
        user_id_fk: 1,
        public_id: nanoid(),
        project_name: "Smart-Lamp",
        api_key: generateApiKey(),
        board_type: "ESP32",
      },
      {
        id: 2,
        user_id_fk: 1,
        public_id: nanoid(),
        project_name: "iot-led",
        api_key: generateApiKey(),
        board_type: "ESP8266",
      },

      {
        id: 3,
        user_id_fk: 2,
        public_id: nanoid(),
        project_name: "smart-sensor",
        api_key: generateApiKey(),
        board_type: "ESP32",
      },
      {
        id: 4,
        user_id_fk: 3,
        public_id: nanoid(),
        project_name: "iot-controller",
        api_key: generateApiKey(),
        board_type: "ESP8266",
      },
      {
        id: 5,
        user_id_fk: 4,
        public_id: nanoid(),
        project_name: "led-display",
        api_key: generateApiKey(),
        board_type: "ESP32",
      },
    ],
    { transaction: transaction }
  );

  await Release.bulkCreate(
    [
      {
        version: "1.0.0",
        flatten_version: getNormalizedVersion("1.0.0"),
        public_id: nanoid(21),
        project_id_fk: 1,
      },
      {
        version: "1.0.1",
        flatten_version: getNormalizedVersion("1.0.1"),
        public_id: nanoid(21),
        project_id_fk: 1,
      },
      {
        version: "1.9.10",
        flatten_version: getNormalizedVersion("1.9.10"),
        public_id: nanoid(21),
        project_id_fk: 1,
      },
      {
        version: "1.10.2",
        flatten_version: getNormalizedVersion("1.10.2"),
        public_id: nanoid(21),
        project_id_fk: 1,
      },
      {
        version: "2.0.0",
        flatten_version: getNormalizedVersion("2.0.0"),
        public_id: nanoid(21),
        project_id_fk: 1,
      },

      {
        version: "1.0.0",
        flatten_version: getNormalizedVersion("1.0.0"),
        public_id: nanoid(21),
        project_id_fk: 3,
      },
      {
        version: "1.0.1",
        flatten_version: getNormalizedVersion("1.0.1"),
        public_id: nanoid(21),
        project_id_fk: 3,
      },
      {
        version: "1.1.0",
        flatten_version: getNormalizedVersion("1.1.0"),
        public_id: nanoid(21),
        project_id_fk: 3,
      },
      {
        version: "1.2.0",
        flatten_version: getNormalizedVersion("1.2.0"),
        public_id: nanoid(21),
        project_id_fk: 3,
      },
      {
        version: "2.0.0",
        flatten_version: getNormalizedVersion("2.0.0"),
        public_id: nanoid(21),
        project_id_fk: 3,
      },

      {
        version: "1.0.0",
        flatten_version: getNormalizedVersion("1.0.0"),
        public_id: nanoid(21),
        project_id_fk: 4,
      },
      {
        version: "1.0.1",
        flatten_version: getNormalizedVersion("1.0.1"),
        public_id: nanoid(21),
        project_id_fk: 4,
      },
      {
        version: "1.1.0",
        flatten_version: getNormalizedVersion("1.1.0"),
        public_id: nanoid(21),
        project_id_fk: 4,
      },
      {
        version: "1.2.0",
        flatten_version: getNormalizedVersion("1.2.0"),
        public_id: nanoid(21),
        project_id_fk: 4,
      },
      {
        version: "2.0.0",
        flatten_version: getNormalizedVersion("2.0.0"),
        public_id: nanoid(21),
        project_id_fk: 4,
      },

      {
        version: "1.0.0",
        flatten_version: getNormalizedVersion("1.0.0"),
        public_id: nanoid(21),
        project_id_fk: 5,
      },
      {
        version: "1.0.1",
        flatten_version: getNormalizedVersion("1.0.1"),
        public_id: nanoid(21),
        project_id_fk: 5,
      },
      {
        version: "1.1.0",
        flatten_version: getNormalizedVersion("1.1.0"),
        public_id: nanoid(21),
        project_id_fk: 5,
      },
      {
        version: "1.2.0",
        flatten_version: getNormalizedVersion("1.2.0"),
        public_id: nanoid(21),
        project_id_fk: 5,
      },
      {
        version: "2.0.0",
        flatten_version: getNormalizedVersion("2.0.0"),
        public_id: nanoid(21),
        project_id_fk: 5,
      },
    ],
    { transaction: transaction }
  );

  // await Environment.bulkCreate(
  //   [
  //     { release_id_fk: 1, status: "STAGING" },
  //     { release_id_fk: 2, status: "STAGING" },
  //     { release_id_fk: 3, status: "PRODUCTION" },
  //     { release_id_fk: 4, status: "STAGING" },

  //     { release_id_fk: 6, status: "STAGING" },
  //     { release_id_fk: 7, status: "STAGING" },
  //     { release_id_fk: 8, status: "PRODUCTION" },
  //     { release_id_fk: 9, status: "STAGING" },
  //     { release_id_fk: 10, status: "PRODUCTION" },
  //     { release_id_fk: 11, status: "STAGING" },
  //     { release_id_fk: 12, status: "STAGING" },
  //     { release_id_fk: 13, status: "PRODUCTION" },
  //     { release_id_fk: 14, status: "STAGING" },
  //     { release_id_fk: 15, status: "PRODUCTION" },
  //     { release_id_fk: 16, status: "STAGING" },
  //     { release_id_fk: 17, status: "STAGING" },
  //     { release_id_fk: 18, status: "PRODUCTION" },
  //     { release_id_fk: 19, status: "STAGING" },
  //     { release_id_fk: 20, status: "PRODUCTION" },
  //   ],
  //   { transaction: transaction }
  // );

  await transaction.commit();
  Logger.info("Database has been seeded!");
} catch (error) {
  log(error);
  await transaction.rollback();
  Logger.error("Database seed error");
}
