import WebSocket from "ws";
import { ArgumentParser } from "argparse";
import { version } from "./package.json";
import { spawn } from "child_process";

type MessageType = {
  type: string;
  payload?: {};
};

const parser = new ArgumentParser();
// prettier-ignore
{
  parser.add_argument("-v", "--version", { action: "version", version });
  parser.add_argument("-H", "--host", { help: "Hose name of server", default: "localhost" });
  parser.add_argument("-P", "--port", {  help: "Port number of server", type: "int", default: 7953 });
  parser.add_argument("-R", "--reconnect", { help: "Try to reconnect server if closed", action: "store_true" });
  parser.add_argument("-O", "--stdout", { help: "Print stdout of command", action: "store_true" });
  const group = parser.add_mutually_exclusive_group({ required: true });
  group.add_argument('-t', '--topic', { help: 'Topic to subscribe (i.e. -T topic1 -T topic2)', action: 'append' });
  group.add_argument('-a', '--all', { help: 'Subscribe all topics', action: 'store_true' });
  parser.add_argument("command", { help: "Command to run" });
}

const args = parser.parse_args();

const target = spawn(args.command, [], { shell: true });

async function connect() {
  console.log("connect");
  const socket = new WebSocket(`ws://${args.host}:${args.port}`);
  console.log("socket");

  await new Promise<void>((resolve) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "$subscribe",
          payload: args.all ? { all: true } : { topics: args.topic },
        })
      );
      resolve();
    });
  });

  console.log("open");

  socket.on("message", (message) => {
    process.stdin.write(message.toString());
    process.stdin.flush();
  });

  process.stdout.on("data", (data) => {
    console.log("data");
    const text = data.toString();
    if (args.stdout) {
      console.log(text);
    }
    try {
      const message = JSON.parse(text) as MessageType;
      if (typeof message.type === "string") {
        socket.send(text);
      } else {
        console.error("Invalid message type");
      }
    } catch (e) {
      console.error("Invalid message format");
    }
  });

  const interval = setInterval(() => {
    if (target.exitCode !== null || target.pid === null) {
      console.log("exit");
      process.exit(target.exitCode ?? undefined);
    }
  }, 500);

  await new Promise<void>((resolve) => {
    socket.on("close", () => {
      console.log("Connection closed");
      resolve();
    });
  });

  clearInterval(interval);
}

connect();
