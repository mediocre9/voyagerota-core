import * as ProjectDAL from "@dal/project.dal";
import * as TelemetryDAL from "@dal/telemetry.dal";
import * as TopicDAL from "@dal/topic.dal";
import { ProjectIdQueryParam, ProjectIdQueryParamSchema } from "@schemas/project.schema";
import { TelemetryIdAndTopicDTO, TelemetryIdAndTopicSchema } from "@schemas/telemetry.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import * as Utils from "@utils/utils";
import axios, { AxiosResponse } from "axios";
import { generate } from "generate-password";
import { StatusCodes } from "http-status-codes";

import { inject, injectable } from "tsyringe";

/**
 * ! REMEMBER FADI Refactor this service but currently not a priority right now for telemetry feature..
 * TODO: [PRI-0] ADD LIMIT TO TOPICS UPTO 5....
 * TODO: [PRI-1] REFACTOR THIS SERVICE....
 * TODO: [PRI-2] move creds to ENV later....
 * TODO: [PRI-2] Embed Input sanitization to zod schemas....
 * TODO: [PRI-3] Consider to use axios with retry mechanisms and better error handling....
 * TODO: Protect it with 4 seconds per request rate limiting for each devices
 * TODO: Remove the password from logs
 */
type BrokerUserAuth = {
  username: string;
  password: string;
};

interface BrokerAuthDBResponse {
  user_id: string;
  is_superuser: string;
}

@injectable()
export class MQTTBrokerService {
  constructor(private readonly BASE_URL: string = process.env.BROKER_BASE_URL) {}

  public async isUserRegistered(username: string): Promise<boolean> {
    const url = `/api/v5/authentication/password_based:built_in_database/users/${username}`;
    const response = await axios({
      method: "GET",
      url: url,
      baseURL: this.BASE_URL,
      validateStatus: (status) => status >= 200 && status <= 404,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(process.env.BROKER_BASIC_AUTH_CREDENTIALS).toString(
          "base64"
        )}`,
      },
    });
    return response.status === 200;
  }

  public async deleteUser(username: string): Promise<boolean> {
    const url = `/api/v5/authentication/password_based:built_in_database/users/${username}`;
    const response = await axios({
      method: "DELETE",
      validateStatus: (status) => status >= 200 && status <= 404,
      url: url,
      baseURL: this.BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(process.env.BROKER_BASIC_AUTH_CREDENTIALS).toString(
          "base64"
        )}`,
      },
    });
    return response.status === 204;
  }

  public async createUser(
    username: string,
    password: string
  ): Promise<AxiosResponse<Pick<BrokerAuthDBResponse, "user_id">>> {
    const url = "/api/v5/authentication/password_based:built_in_database/users";
    const payload = JSON.stringify({ user_id: username, password: password });

    const response = await axios.post<BrokerAuthDBResponse>(url, payload, {
      baseURL: this.BASE_URL,
      validateStatus: (status) => status >= 200 && status <= 404,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(process.env.BROKER_BASIC_AUTH_CREDENTIALS).toString(
          "base64"
        )}`,
      },
    });

    return response;
  }
}

@injectable()
export class TelemetryTopicService {
  constructor(private _topic: string = "telemetry") {}

  public async createTopic(payload: TelemetryIdAndTopicDTO): Promise<void> {
    const { telemetryId, topic } = await TelemetryIdAndTopicSchema.parseAsync(payload);

    const topicInstance = await TopicDAL.findTopicByTelemetryId(telemetryId);

    if (!topicInstance) {
      throw new ApiError("Topic not found!", StatusCodes.NOT_FOUND);
    }

    const actualTopic = this._topicStringBuilder(topicInstance.id!, topic);

    if (await TopicDAL.isTopicLimitReached(topicInstance.id!)) {
      throw new ApiError("Topic creation max limit is upto 5!", StatusCodes.BAD_REQUEST);
    }

    await TopicDAL.createTopic(topicInstance.id!, actualTopic);
    Logger.info("Topic has been created successfully!");
  }

  public async updateTopic(payload: TelemetryIdAndTopicDTO): Promise<void> {
    const { telemetryId, topic } = await TelemetryIdAndTopicSchema.parseAsync(payload);

    const topicInstance = await TopicDAL.findTopicByTelemetryId(telemetryId);

    if (!topicInstance) {
      throw new ApiError("Topic not found!", StatusCodes.NOT_FOUND);
    }

    const actualTopic = this._topicStringBuilder(topicInstance.id!, topic);

    await TopicDAL.updateTopic(topicInstance.id!, actualTopic);

    Logger.info("Topic updated successfully!");
  }

  private _topicStringBuilder(projectId: number, topic: string): string {
    return `${this._topic}/${projectId}/${topic}`;
  }
}

/**
 * @class TelemetryRegistryService
 */
@injectable()
export class TelemetryRegistryService {
  constructor(@inject(MQTTBrokerService) private readonly _service: MQTTBrokerService) {}

  public async enableTelemetry(queryParam: ProjectIdQueryParam): Promise<number> {
    const { projectId } = await ProjectIdQueryParamSchema.parseAsync(queryParam);

    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    const isTelemetryEnabled = await TelemetryDAL.isTelemetryEnabled(project.id!);
    if (isTelemetryEnabled) {
      throw new ApiError(
        "Telemetry Service is already enabled for this project!",
        StatusCodes.CONFLICT
      );
    }

    const username = Utils.generateRandomSpaceUsername();
    const telemetry = await TelemetryDAL.enableTelemetry(project.id!, username);
    const id = telemetry.id!;
    return id;
  }

  public async registerUserOnBroker(queryParam: ProjectIdQueryParam): Promise<BrokerUserAuth> {
    const { projectId } = await ProjectIdQueryParamSchema.parseAsync(queryParam);

    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    const isTelemetryEnabled = await TelemetryDAL.isTelemetryEnabled(project.id!);
    if (!isTelemetryEnabled) {
      throw new ApiError(
        "Telemetry Service is not enabled for this project!",
        StatusCodes.FORBIDDEN
      );
    }

    const { username } = isTelemetryEnabled;
    if (await this._service.isUserRegistered(username!)) {
      throw new ApiError("User is already registered for broker database!", StatusCodes.CONFLICT);
    }

    const password = generate({ length: 10, numbers: true });
    const result = await this._service.createUser(username!, password);

    if (result.status !== 201) {
      throw new ApiError("Telemetric User Auth Registration Failed!", result.status);
    }

    Logger.info("User Credentials has been generated successfully!");
    const payload: BrokerUserAuth = {
      username: result.data.user_id,
      password: password,
    };
    return payload;
  }
}
