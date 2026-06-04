import { Release, ReleaseAttributesDTO } from "@models/release.model";
import { TaskArtifactStatus } from "@services/artifact.queue.service";
import { ProjectDTOFields } from "@services/project.service";

export type Nullable<T> = T | null;
export type NullableOrUndefined<T> = T | null | undefined;

type StatusResponse = {
  status: {
    reason: string;
    code: number;
  };
};

export type ReleaseArtifactCreationResponse = {
  message: string;
} & StatusResponse;

export type ArtifactTaskCreationResponse = {
  task: TaskArtifactStatus;
} & StatusResponse;

export type ReleaseListArtifactsResponse = {
  releases: readonly ReleaseAttributesDTO[];
} & StatusResponse;

export type LatestReleaseArtificatResponse = {
  release: Nullable<Release> | string;
} & StatusResponse;

export interface ProjectData {
  publicId: string;
  name: string;
  secretKey: string;
}

export type ProjectCreationResponse = {
  project: ProjectData;
  board: "ESP32" | "ESP8266";
} & StatusResponse;

export type ProjectListResponse = {
  projects: readonly ProjectDTOFields[];
} & StatusResponse;

export type ProjectDeletedResponse = {
  message: string;
} & StatusResponse;

export type DeviceRegistryResponse = {
  message: string;
} & StatusResponse;

export type TelemetryUserAuthResponse = {
  message: string;
  payload: {
    username: string;
    password: string;
  };
} & StatusResponse;

export type TelemetryRegistryResponse = {
  publicId: string;
  message: string;
} & StatusResponse;

export type TelemetryTopicCreationResponse = {
  message: string;
} & StatusResponse;

export type TelemetryTopicUpdateResponse = {
  message: string;
} & StatusResponse;
