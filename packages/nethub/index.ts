import WebSocket, { WebSocketServer, errorMonitor } from "ws";
import { ArgumentParser } from "argparse";
import { version } from "./package.json";

type MessageType = {
  type: "$subscribe";
  payload:
    | { all: true; topics?: undefined }
    | { all?: false; topics: string[] };
};

const parser = new ArgumentParser();
// prettier-ignore
{
  parser.add_argument("-v", "--version", { action: "version", version });
  parser.add_argument("-H", "--host", { help: "Hose name to serve", default: "localhost" });
  parser.add_argument("-P", "--port", { help: "Port number to serve", type: "int", default: 7953 });
}
const args = parser.parse_args();
const server = new WebSocketServer({
  host: args.host,
  port: args.port,
});

class SubscriberManager {
  constructor(
    private allSubscribes: WebSocket[] = [],
    private subscribersMap: Map<string, WebSocket[]> = new Map()
  ) {}

  subscribe(topic: string, socket: WebSocket) {
    this.subscribersMap.set(topic, this.subscribersMap.get(topic) ?? []);
    this.subscribersMap.get(topic)!.push(socket);
  }

  subscribeAll(socket: WebSocket) {
    this.allSubscribes.push(socket);
  }

  getSubscribers(topic: string) {
    return [...(this.subscribersMap.get(topic) ?? []), ...this.allSubscribes];
  }
}

const subscriberManager = new SubscriberManager();

function handleMessage(
  server: WebSocketServer,
  socket: WebSocket,
  message: WebSocket.Data
) {
  const { type } = JSON.parse(message.toString()) as { type: string };
  const subscribers = subscriberManager.getSubscribers(type);
  subscribers.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.on("connection", (socket) => {
  console.log("connected");
  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString()) as MessageType;
      if (data.type === "$subscribe") {
        if (data.payload.all) {
          subscriberManager.subscribeAll(socket);
        } else {
          for (const topic of data.payload.topics) {
            subscriberManager.subscribe(topic, socket);
          }
        }
      } else {
        handleMessage(server, socket, message);
      }
    } catch (error) {
      console.error(error);
    }
  });
});
