import { BrokerServiceError } from "@utils/error";
import { Logger } from "@utils/logger";
import { generate } from "generate-password";
import * as Utils from "@utils/utils";

/**
 * TODO: Protect it with 4 seconds per request rate limiting for each devices
 * TODO: Remove the password from logs
 * TODO: [PRI-03] Consider to use axios with retry mechanisms and better error handling....
 * TODO: [PRI-02] move creds to ENV later....
 */

type BrokerAuthSuccessResponse = {
  user_id: string;
};

export class TelemetryRegistryService {
  private URL = process.env.BROKER_USER_ENDPOINT;

  public async createUserOnBrokerDatabase() {
    const generatedPassword = generate({ length: 10, numbers: true });
    const payload = {
      user_id: Utils.getUniqueGeneratedUserName(),
      password: generatedPassword,
    };

    const response = await fetch(this.URL, {
      method: "POST",
      body: JSON.stringify({ user_id: payload.user_id, password: payload.password }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(process.env.BROKER_SECRET).toString(
          "base64"
        )}`,
      },
    });

    const data = (await response.json()) as BrokerAuthSuccessResponse;
    if (response.status !== 201) {
      Logger.error(JSON.stringify(data));
      throw new BrokerServiceError(JSON.stringify(data), response.status);
    }

    Logger.info("User registered for MQTT telemetry!");
    Logger.warn(JSON.stringify({ ...data, password: generatedPassword }));
  }

  public async removeUserOnBrokerDatabase() {}
}
