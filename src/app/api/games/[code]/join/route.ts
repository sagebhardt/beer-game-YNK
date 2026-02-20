import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();
    const body = await request.json();
    const { name } = body;

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

    if (game.status !== "LOBBY") {
      return NextResponse.json(
        { error: "El juego ya comenzó" },
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
        },
        game: { accessCode: game.accessCode },
      });
    }

    // Check player count
    if (game.players.length >= 4) {
      return NextResponse.json(
        { error: "El juego está lleno (máximo 4 jugadores)" },
        { status: 400 }
      );
    }

    const player = await prisma.player.create({
      data: {
        gameId: game.id,
        name: name.trim(),
        sessionId,
        role: "",
      },
    });

    return NextResponse.json({
      player: { id: player.id, name: player.name, role: player.role },
      game: { accessCode: game.accessCode },
    });
  } catch (error) {
    console.error("Error al unirse:", error);
    return NextResponse.json(
      { error: "Error al unirse al juego" },
      { status: 500 }
    );
  }
}
