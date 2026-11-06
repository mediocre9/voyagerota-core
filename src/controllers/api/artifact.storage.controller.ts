import {
  ReleaseArtifactIdPathParams,
  ReleaseArtifactIdPathParamsSchema,
  ReleaseDownloadHeaderSchema,
  ReleaseIdPathParam,
  ReleaseIdPathParamSchema,
} from "@schemas/release.schema";
import { ArtifactStorageService, MAX_FILE_SIZE_IN_BYTES } from "@services/artifact.storage.service";
import { ApiError } from "@utils/error";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import * as fs from "node:fs";
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

  // TODO move DAL logic to service layer.....
  async streamDownload(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const params = await ReleaseArtifactIdPathParamsSchema.parseAsync(request.params);
      const headers = await ReleaseDownloadHeaderSchema.parseAsync({
        apiKey: request.get("x-api-key"),
        projectId: request.get("x-project-id"),
      });

      const { path: filePath, artifact } = await this._storage.getBinaryFilePath({
        ...params,
        ...headers,
      });

      response.setHeader("content-length", artifact.getFileSize());
      response.setHeader("content-type", "application/octet-stream");
      response.setHeader("cache-control", "no-cache");
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
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
