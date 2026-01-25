import { Logger } from "@utils/logger";
import mqtt from "mqtt";
import { Server } from "socket.io";
import { log } from "console";
import { EnvConfig } from "@config/config";

const io = new Server({
  transports: ["websocket"],
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (_) => {
  Logger.info("webscoket server up!");
});

const client = mqtt.connect(EnvConfig.MQTT_ADDRESS, {
  clean: true,
  port: EnvConfig.MQTT_PORT,
  clientId: EnvConfig.MQTT_CLIENT_ID,
  username: EnvConfig.MQTT_USERNAME,
  password: EnvConfig.MQTT_PASSWORD,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

client.on("error", (error: unknown) => {
  if (error === "string") Logger.error(`Error: ${error.toString()}`);
});

client.on("connect", (packet: mqtt.IConnackPacket) => {
  Logger.info("Telemetry Service is Up!");
  client.subscribe("telemetry-data");
});

type SocketData = {
  rssi: string;
  version: string;
  freeHeap: string;
  username: string;
  deviceId: string;
  clientId: string;
  projectId: string;
};

client.on("message", (topic, payload) => {
  if (topic === "telemetry/#") {
    log(topic);
    const data = JSON.parse(payload.toString()) as SocketData;
    log({ ...data });
    io.emit("message", data);
  }
});

export default io;
