import type { Server as SocketIOServer } from "socket.io";

export function getIO(): SocketIOServer | null {
  return (globalThis as Record<string, unknown>).__io as SocketIOServer | null;
}
