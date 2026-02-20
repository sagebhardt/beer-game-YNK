import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { getPlayerState, getHostState } from "@/lib/game-engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();

    const game = await prisma.game.findUnique({
      where: { accessCode: code },
      include: { players: true },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Juego no encontrado" },
        { status: 404 }
      );
    }

    const isHost = game.hostSessionId === sessionId;
    const player = game.players.find((p) => p.sessionId === sessionId);

    // If game is in lobby, return basic info
    if (game.status === "LOBBY") {
      return NextResponse.json({
        game: {
          accessCode: game.accessCode,
          name: game.name,
          status: game.status,
          totalRounds: game.totalRounds,
        },
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          isConnected: p.isConnected,
        })),
        isHost,
        currentPlayer: player
          ? { id: player.id, name: player.name, role: player.role }
          : null,
      });
    }

    // If game is active or completed
    if (!player) {
      return NextResponse.json(
        { error: "No estás en este juego" },
        { status: 403 }
      );
    }

    if (isHost) {
      const hostState = await getHostState(game.id);
      return NextResponse.json({ ...hostState, isHost: true });
    }

    const playerState = await getPlayerState(game.id, sessionId);
    return NextResponse.json(playerState);
  } catch (error) {
    console.error("Error al obtener estado:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado del juego" },
      { status: 500 }
    );
  }
}
