import WebSocket, { WebSocketServer, errorMonitor } from "ws";
import { ArgumentParser } from "argparse";
import { version } from "./package.json";

type MessageType = {
  topic: "$subscribe";
  payload: { all: true; topics?: undefined } | { all?: false; topics: string[] };
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
  constructor(private allSubscribes: WebSocket[] = [], private subscribersMap: Map<string, WebSocket[]> = new Map()) {}

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

function handleMessage(server: WebSocketServer, socket: WebSocket, message: WebSocket.Data) {
  const { topic } = JSON.parse(message.toString()) as { topic: string };
  const subscribers = subscriberManager.getSubscribers(topic);
  subscribers.forEach((client) => {
    if (client !== socket && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.on("connection", (socket, request) => {
  console.log("connected", request.socket.remoteAddress, request.socket.remotePort);
  socket.on("error", (error) => (console.log("error", request.socket.remoteAddress, request.socket.remotePort), console.error(error)));
  socket.on("close", () => console.log("closed", request.socket.remoteAddress, request.socket.remotePort));
  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString()) as MessageType;
      if (data.topic === "$subscribe") {
        console.log("subscription", data.payload);
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
