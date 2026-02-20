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
  const host = "0.0.0.0";

  console.log(`[boot] NODE_ENV=${process.env.NODE_ENV || "undefined"}`);
  console.log(`[boot] PORT=${port}`);
  console.log(`[boot] HOST=${host}`);
  console.log(`[boot] DATA_DIR=${process.env.DATA_DIR || "/app/data"}`);

  httpServer.on("error", (error) => {
    console.error("[boot] HTTP server failed to start:", error);
    process.exit(1);
  });

  httpServer.listen(port, host, () => {
    console.log(`> Beer Game listo en http://${host}:${port}`);
  });
}).catch((error) => {
  console.error("[boot] Next.js app preparation failed:", error);
  process.exit(1);
});
