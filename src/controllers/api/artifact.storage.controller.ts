import {
  ReleaseArtifactIdPathParams,
  ReleaseArtifactIdPathParamsSchema,
  ReleaseIdPathParam,
  ReleaseIdPathParamSchema,
} from "@schemas/release.schema";
import { ArtifactStorageService, MAX_FILE_SIZE_IN_BYTES } from "@services/artifact.storage.service";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import * as fs from "node:fs";
import { DeviceLocals } from "@middlewares/device.auth";
import { Logger } from "@utils/logger";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { inject, injectable } from "tsyringe";

@injectable()
export class ArtifactStorageController {
  constructor(
    @inject(ArtifactStorageService)
    private readonly _storage: ArtifactStorageService,
  ) {}

  async deleteBlob(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const params = await ReleaseArtifactIdPathParamsSchema.parseAsync(request.params);
      await this._storage.remove(params);
      response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
      next(error);
    }
  }

  async streamDownload(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ): Promise<void> {
    await this._streamArtifact(request, response, next, { releasedOnly: true });
  }

  async streamProjectDownload(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ): Promise<void> {
    await this._streamArtifact(request, response, next, { releasedOnly: false });
  }

  private async _streamArtifact(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
    options: { releasedOnly: boolean },
  ): Promise<void> {
    try {
      const params = await ReleaseArtifactIdPathParamsSchema.parseAsync(request.params);
      const artifact = await this._storage.getDownloadableArtifact(
        params,
        response.locals.project,
        options,
      );

      // open the file before sending headers so a missing blob becomes a proper error response....
      const fileStream = fs.createReadStream(artifact.path);
      await once(fileStream, "open");

      response.setHeader("content-length", artifact.size);
      response.setHeader("content-type", "application/octet-stream");
      response.setHeader("cache-control", "no-cache");
      await pipeline(fileStream, response);
    } catch (error) {
      if (response.headersSent) {
        // the device sees a truncated body and HTTPUpdate fails the size check....
        Logger.error(`Artifact download interrupted: ${(error as Error).message}`);
        response.destroy();
        return;
      }
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        next(new ApiError("Artifact file is missing from storage!", StatusCodes.NOT_FOUND));
        return;
      }
      next(error);
    }
  }

  async upload(
    request: Request<ReleaseIdPathParam>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const params = await ReleaseIdPathParamSchema.parseAsync(request.params);

      // ! [PRI-1] this does not work investigate the issue.......
      if (!request.file) {
        throw new ApiError("File not selected!", StatusCodes.BAD_REQUEST);
      }

      if (request.file.mimetype !== "application/octet-stream") {
        throw new ApiError("Only binary file is allowed!", StatusCodes.BAD_REQUEST);
      }

      // *restrict at nginx level as well....
      if (request.file.size > MAX_FILE_SIZE_IN_BYTES) {
        throw new ApiError("Max file size limit is 8mb!", StatusCodes.BAD_REQUEST);
      }

      const artifact = await this._storage.save(request.file, params);
      response.status(StatusCodes.CREATED).json({
        id: artifact.id,
        filename: request.file?.originalname,
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
