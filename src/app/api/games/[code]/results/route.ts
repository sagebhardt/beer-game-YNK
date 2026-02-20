import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionIdReadonly } from "@/lib/session";
import { getHostState } from "@/lib/game-engine";
import { computeOptimalCosts } from "@/lib/optimal-cost";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionIdReadonly();

    const game = await prisma.game.findUnique({
      where: { accessCode: code },
      include: {
        players: {
          select: { sessionId: true },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
    }

    const inGame = !!sessionId && game.players.some((player) => player.sessionId === sessionId);
    const isHost = sessionId === game.hostSessionId;
    const isController = !!sessionId && sessionId === game.controllerSessionId;

    if (!inGame && !isHost && !isController) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (game.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Los resultados se habilitan al completar el juego" },
        { status: 400 }
      );
    }

    const state = await getHostState(game.id);

    // Compute optimal (perfect-information) costs
    const demandPattern: number[] = JSON.parse(game.demandPattern);
    const optimal = computeOptimalCosts({
      demandPattern,
      totalRounds: game.totalRounds,
      startInventory: game.startInventory,
      holdingCost: game.holdingCost,
      backlogCost: game.backlogCost,
      orderDelay: game.orderDelay,
      shippingDelay: game.shippingDelay,
    });

    return NextResponse.json({
      ...state,
      game: {
        ...state.game,
        endedReason: game.endedReason,
        endedAt: game.endedAt?.toISOString() ?? null,
      },
      optimal: {
        perRole: optimal.perRole,
        perRoleTotalCost: optimal.perRoleTotalCost,
        totalChainCost: optimal.totalChainCost,
      },
    });
  } catch (error) {
    console.error("Error al obtener resultados:", error);
    return NextResponse.json(
      { error: "Error al obtener resultados" },
      { status: 500 }
    );
  }
}
