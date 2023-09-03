import WebSocket from "ws";
import { ArgumentParser } from "argparse";
import { version } from "./package.json";
import { spawn } from "child_process";

type MessageType = {
  topic: string;
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
  const group = parser.add_mutually_exclusive_group();
  group.add_argument('-T', '--topic', { help: 'Topic to subscribe (i.e. -T topic1 -T topic2)', action: 'append' });
  group.add_argument('-A', '--all', { help: 'Subscribe all topics', action: 'store_true' });
  parser.add_argument("command", { help: "Command to run" });
}

const args = parser.parse_args();

async function connect() {
  const socket = new WebSocket(`ws://${args.host}:${args.port}`);
  socket.on("error", (error) => console.error(error));

  await new Promise<void>((resolve) => {
    socket.on("open", () => {
      resolve();
    });
  });

  socket.send(
    JSON.stringify({
      topic: "$subscribe",
      payload: args.all ? { all: true } : { topics: args.topic ?? [] },
    })
  );

  const target = spawn(args.command, [], { shell: true });
  target.stderr.pipe(process.stderr);

  socket.on("message", (message) => {
    target.stdin.write(message.toString() + "\n");
  });

  target.stdout.on("data", (data) => {
    for (const text of data.toString().trim().split("\n")) {
      if (args.stdout) {
        console.log(text);
      }
      try {
        const message = JSON.parse(text) as MessageType;
        if (typeof message.topic === "string") {
          socket.send(text);
        } else {
          console.error("Invalid topic");
        }
      } catch (e) {
        console.error("Invalid message format");
      }
    }
  });

  const interval = setInterval(() => {
    if (target.exitCode !== null || target.pid === null) {
      console.log("exit");
      clearInterval(interval);
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
