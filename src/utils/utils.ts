import otp from "otp-generator";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as semver from "semver";
import { uniqueNamesGenerator, adjectives, colors } from "unique-names-generator";
import { spaceNames } from "./space-dictionary-names";
import { log } from "node:console";

export type Nullable<T> = T | null;
export type NullableOrUndefined<T> = T | null | undefined;

/**
 *
 * @todo **FADI MOVE THIS TO SOMEWHERE ELSE, NOT IN UTILS......**
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * @deprecated This function has been deprecated.
 * Use `getNormalizedVersion` function.
 * @param version
 * @returns version in numbers
 */
export function flattenVersion(version: string): number {
  const versionWithoutPeriods: string = version.replaceAll(".", "");
  const versionInNumber: number = parseInt(versionWithoutPeriods);
  return versionInNumber;
}

/**
 *
 * @param version
 * @description Converts semver version into a normalized padded 7-digit `0s` numeric value.
 * @example "1.1.19" => 100000010000019
 * @returns normalized number version
 */
export function getNormalizedVersion(version: string): number {
  const PADDING_SIZE = 7;
  const chunks: string[] = version.split(".");

  if (chunks[0].split("").length > PADDING_SIZE) {
    throw new Error("MAJOR version length is greater than 7!");
  }

  if (chunks[1].split("").length > PADDING_SIZE) {
    throw new Error("MINOR version length is greater than 7!");
  }

  if (chunks[2].split("").length > PADDING_SIZE) {
    throw new Error("PATCH version length is greater than 7!");
  }

  chunks[1] = chunks[1].padStart(PADDING_SIZE, "0");
  chunks[2] = chunks[2].padStart(PADDING_SIZE, "0");
  const normalized = chunks.join("");
  return parseInt(normalized);
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

export function generateRandomSpaceUsername(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, spaceNames],
    style: "lowerCase",
  });
}

export function isSemver(version: string): boolean {
  try {
    const isCleanFormat = semver.clean(version, { loose: false });
    if (!isCleanFormat) return false;

    const coerced = semver.coerce(version, { loose: false, includePrerelease: false });
    if (!coerced) return false;

    const isValid = semver.valid(coerced);
    if (!isValid) return false;

    return true;
  } catch (error) {
    log(error);
    throw error;
  }
}

/**
 *
 * @description Generates a random API key with an abbreviated prefix of abbreaviation of voyager as vygr_.
 * @example vygr_RANDOM_API_KEY_VALUE
 * @returns strings
 */
export function generateApiKey(): string {
  return "vygr_" + crypto.randomBytes(16).toString("hex");
}

export async function generateFileHash(filename: string): Promise<string> {
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
