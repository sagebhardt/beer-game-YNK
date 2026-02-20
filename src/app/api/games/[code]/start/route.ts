import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { initializeGame } from "@/lib/game-engine";
import { ROLES } from "@/lib/types";
import { getIO } from "@/lib/socket-server";
import { S2C } from "@/lib/socket-events";
import { emitAdminGameUpsert } from "@/lib/admin-monitor";

export async function POST(
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

    if (game.hostSessionId !== sessionId) {
      return NextResponse.json(
        { error: "Solo el anfitrión puede iniciar el juego" },
        { status: 403 }
      );
    }

    if (game.status !== "LOBBY") {
      return NextResponse.json(
        { error: "El juego ya fue iniciado" },
        { status: 400 }
      );
    }

    if (game.mode === "TEST") {
      return NextResponse.json(
        { error: "El modo Test se inicia automáticamente" },
        { status: 400 }
      );
    }

    // Check all 4 roles are assigned
    const assignedRoles = game.players
      .map((p) => p.role)
      .filter((r) => ROLES.includes(r as (typeof ROLES)[number]));
    const missingRoles = ROLES.filter((r) => !assignedRoles.includes(r));

    if (missingRoles.length > 0) {
      return NextResponse.json(
        { error: `Faltan roles por asignar: ${missingRoles.join(", ")}` },
        { status: 400 }
      );
    }

    await initializeGame(game.id);

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(code).emit(S2C.GAME_STARTED, { currentRound: 1 });
      await emitAdminGameUpsert(io, code);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al iniciar juego:", error);
    return NextResponse.json(
      { error: "Error al iniciar el juego" },
      { status: 500 }
    );
  }
}
