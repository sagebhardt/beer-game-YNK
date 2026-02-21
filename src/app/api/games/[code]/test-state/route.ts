import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { getHostState } from "@/lib/game-engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();

    const game = await prisma.game.findUnique({
      where: { accessCode: code },
      select: {
        id: true,
        mode: true,
        status: true,
        controllerSessionId: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
    }

    if (game.mode !== "TEST") {
      return NextResponse.json({ error: "Este juego no está en modo Test" }, { status: 400 });
    }

    if (game.controllerSessionId !== sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // If game already completed, return minimal payload so the test page
    // redirects to results (it checks game.status === "COMPLETED")
    if (game.status === "COMPLETED") {
      return NextResponse.json({
        game: { status: "COMPLETED", accessCode: code },
        players: [],
        submissions: null,
      });
    }

    const state = await getHostState(game.id);

    return NextResponse.json({
      ...state,
      isController: true,
    });
  } catch (error) {
    console.error("Error al obtener estado test:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado del juego" },
      { status: 500 }
    );
  }
}
