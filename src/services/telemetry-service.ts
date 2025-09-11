import { Logger } from "@utils/logger";
import mqtt from "mqtt";
import { Server } from "socket.io";

const io = new Server({
  transports: ["websocket"],
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  Logger.info("webscoket server up!");
});

const client = mqtt.connect(process.env.BROKER_URL, {
  port: 8883,
  clean: true,
  username: process.env.BROKER_SUPER_USER_USERNAME,
  password: process.env.BROKER_SUPER_USER_PASSWORD,
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
  if (topic === "telemetry-data") {
    const data = JSON.parse(payload.toString()) as SocketData;
    console.log({ ...data });
    io.emit("message", data);
  }
});

io.listen(5000);
