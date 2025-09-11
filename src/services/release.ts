import * as Utils from "@utils/utils";
import * as ReleaseDAL from "@dal/release";
import * as ProjectDAL from "@dal/project";
import path from "path";
import { injectable } from "tsyringe";
import { ReleaseDTO, ReleaseSchema } from "types";
import { Logger } from "@utils/logger";
import { Release } from "@models/release";

@injectable()
export class ReleaseService {
  async preprocessReleaseArtifact(payload: ReleaseDTO) {
    const { projectId, version, filename, changeLog } =
      await ReleaseSchema.parseAsync(payload);

    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new Error("Project not found!");
    }

    if (!Utils.isSemver(version)) {
      throw new Error(`${version} is not a valid semantic version format!`);
    }

    const flattenedVersion = Utils.flattenVersion(version);

    const versionCollision = await ReleaseDAL.findEqualOrOlderVersions(flattenedVersion);
    if (versionCollision) {
      throw new Error(
        `Release artifact version ${version} should be greater than the most recent previous release ${versionCollision.version}!`,
      );
    }

    const hash = await Utils.generateFileHashSignature(
      path.resolve("dump", filename ?? "firmware.bin"),
    );

    const hasViolation = await ReleaseDAL.hasHashSignatureViolation(hash);
    if (hasViolation) {
      throw new Error(
        `The artifact has signature collision with release ${hasViolation.version}.`,
      );
    }

    await ReleaseDAL.createRelease(
      project.id!,
      version,
      flattenedVersion,
      hash,
      changeLog,
    );

    Logger.info("Release has been successfully created!");
  }

  async getReleases(projectId: string): Promise<Readonly<Release[]>> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new Error("Project not found!");
    }

    return await ReleaseDAL.getReleases(project.id!);
  }
}
