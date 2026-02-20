import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setupSocketHandlers } from "./src/lib/socket-handlers";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: {
      origin: dev ? "http://localhost:3000" : undefined,
      methods: ["GET", "POST"],
    },
  });

  (globalThis as Record<string, unknown>).__io = io;

  setupSocketHandlers(io);

  const port = parseInt(process.env.PORT || "3000", 10);
  const hostname = process.env.HOSTNAME || "0.0.0.0";
  httpServer.listen(port, hostname, () => {
    console.log(`> Beer Game listo en http://${hostname}:${port}`);
  });
});
