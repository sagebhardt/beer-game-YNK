import type { Server as SocketIOServer } from "socket.io";
import { C2S, S2C } from "./socket-events";
import { prisma } from "./db";

export function setupSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket) => {
    let currentGameCode: string | null = null;
    let currentSessionId: string | null = null;

    socket.on(C2S.JOIN_ROOM, async ({ gameCode, sessionId }: { gameCode: string; sessionId: string }) => {
      try {
        const game = await prisma.game.findUnique({
          where: { accessCode: gameCode },
          include: { players: true },
        });
        if (!game) {
          socket.emit(S2C.ERROR, { message: "Juego no encontrado" });
          return;
        }

        const player = game.players.find((p) => p.sessionId === sessionId);
        if (!player) {
          socket.emit(S2C.ERROR, { message: "No estás en este juego" });
          return;
        }

        currentGameCode = gameCode;
        currentSessionId = sessionId;
        socket.join(gameCode);

        await prisma.player.update({
          where: { id: player.id },
          data: { isConnected: true },
        });

        // Send current lobby state to the joining player
        const updatedPlayers = await prisma.player.findMany({
          where: { gameId: game.id },
        });
        socket.emit(S2C.LOBBY_STATE, {
          players: updatedPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            isConnected: p.isConnected,
          })),
        });

        // Notify others
        socket.to(gameCode).emit(S2C.PLAYER_JOINED, {
          id: player.id,
          name: player.name,
          role: player.role,
          isConnected: true,
        });
      } catch {
        socket.emit(S2C.ERROR, { message: "Error al unirse a la sala" });
      }
    });

    socket.on(C2S.SELECT_ROLE, async ({ gameCode, role }: { gameCode: string; role: string }) => {
      try {
        if (!currentSessionId) return;

        const game = await prisma.game.findUnique({
          where: { accessCode: gameCode },
          include: { players: true },
        });
        if (!game || game.status !== "LOBBY") return;

        const player = game.players.find((p) => p.sessionId === currentSessionId);
        if (!player) return;

        // Check if role is taken by another player
        const roleTaken = game.players.find(
          (p) => p.role === role && p.id !== player.id
        );
        if (roleTaken) {
          socket.emit(S2C.ERROR, { message: "Ese rol ya está ocupado" });
          return;
        }

        // Clear role from any other player who had it (unique constraint)
        // and update this player's role
        await prisma.player.update({
          where: { id: player.id },
          data: { role },
        });

        io.to(gameCode).emit(S2C.ROLE_SELECTED, {
          playerId: player.id,
          playerName: player.name,
          role,
        });
      } catch {
        socket.emit(S2C.ERROR, { message: "Error al seleccionar rol" });
      }
    });

    socket.on("disconnect", async () => {
      if (!currentGameCode || !currentSessionId) return;

      try {
        const game = await prisma.game.findUnique({
          where: { accessCode: currentGameCode },
          include: { players: true },
        });
        if (!game) return;

        const player = game.players.find((p) => p.sessionId === currentSessionId);
        if (!player) return;

        await prisma.player.update({
          where: { id: player.id },
          data: { isConnected: false },
        });

        socket.to(currentGameCode).emit(S2C.PLAYER_LEFT, {
          playerId: player.id,
          role: player.role,
        });
      } catch {
        // ignore disconnect errors
      }
    });
  });
}
