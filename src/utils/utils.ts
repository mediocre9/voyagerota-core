import otp from "otp-generator";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as semver from "semver";
import { uniqueNamesGenerator, adjectives, colors } from "unique-names-generator";
import { spaceNames } from "./space-dictionary-names";

/**
 *
 * @todo **FADI MOVE THIS TO SOMEWHERE ELSE.. DOES NOT SEEMS TO BELONG HERE....**
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function flattenVersion(version: string): number {
  const versionWithoutPeriods: string = version.replaceAll(".", "");
  const versionInNumber: number = parseInt(versionWithoutPeriods);
  return versionInNumber;
}

export function generateOTPCode(length: number = 6): string {
  const code: string = otp.generate(length, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  return code;
}

export function getUniqueGeneratedUserName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, spaceNames],
    style: "lowerCase",
  });
}

export function isSemver(version: string): boolean {
  return semver.valid(version) !== null ? true : false;
}

/**
 *
 * @description Generates a random API key with an abbreviated prefix of voyager.
 * @example vygr_RANDOM_API_KEY_VALUE
 * @returns strings
 */
export function generateApiKey(): string {
  return "vygr_" + crypto.randomBytes(16).toString("hex");
}

export async function generateFileHashSignature(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filename);

    const hash = crypto.createHash("sha256");
    fileStream.on("data", (data: string | Buffer<ArrayBufferLike>) => {
      hash.update(data);
    });

    fileStream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    fileStream.on("error", (error: Error) => {
      reject(error);
    });
  });
}
