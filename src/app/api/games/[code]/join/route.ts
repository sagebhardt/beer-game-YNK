import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { getIO } from "@/lib/socket-server";
import { emitAdminGameUpsert } from "@/lib/admin-monitor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();
    const body = await request.json();
    const { name, spectate = false } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nombre es requerido" },
        { status: 400 }
      );
    }

    const game = await prisma.game.findUnique({
      where: { accessCode: code.toUpperCase() },
      include: { players: true },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Juego no encontrado" },
        { status: 404 }
      );
    }

    if (game.mode === "TEST") {
      return NextResponse.json(
        { error: "Los juegos en modo Test no admiten participantes" },
        { status: 400 }
      );
    }

    // Spectators can join in LOBBY or ACTIVE; regular players only in LOBBY
    if (!spectate && game.status !== "LOBBY") {
      return NextResponse.json(
        { error: "El juego ya comenzó" },
        { status: 400 }
      );
    }

    if (spectate && game.status === "COMPLETED") {
      return NextResponse.json(
        { error: "El juego ya finalizó" },
        { status: 400 }
      );
    }

    // Check if session already in game
    const existingPlayer = game.players.find((p) => p.sessionId === sessionId);
    if (existingPlayer) {
      return NextResponse.json({
        player: {
          id: existingPlayer.id,
          name: existingPlayer.name,
          role: existingPlayer.role,
          isSpectator: existingPlayer.isSpectator,
        },
        game: { accessCode: game.accessCode, status: game.status },
      });
    }

    if (spectate) {
      // Cap spectators at 10
      const spectatorCount = game.players.filter((p) => p.isSpectator).length;
      if (spectatorCount >= 10) {
        return NextResponse.json(
          { error: "Máximo 10 espectadores por partida" },
          { status: 400 }
        );
      }
    } else {
      // Check player count (only non-spectators count toward 4)
      const playerCount = game.players.filter((p) => !p.isSpectator).length;
      if (playerCount >= 4) {
        return NextResponse.json(
          { error: "El juego está lleno (máximo 4 jugadores)" },
          { status: 400 }
        );
      }
    }

    const player = await prisma.player.create({
      data: {
        gameId: game.id,
        name: name.trim(),
        sessionId,
        role: "",
        isSpectator: !!spectate,
      },
    });

    const io = getIO();
    if (io) {
      await emitAdminGameUpsert(io, game.accessCode);
    }

    return NextResponse.json({
      player: { id: player.id, name: player.name, role: player.role, isSpectator: player.isSpectator },
      game: { accessCode: game.accessCode, status: game.status },
    });
  } catch (error) {
    console.error("Error al unirse:", error);
    return NextResponse.json(
      { error: "Error al unirse al juego" },
      { status: 500 }
    );
  }
}
