import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { processRound, submitBotOrders } from "@/lib/game-engine";
import { ROLES, type Role } from "@/lib/types";
import { getIO } from "@/lib/socket-server";
import { S2C } from "@/lib/socket-events";
import { emitAdminGameUpsert } from "@/lib/admin-monitor";

const ROLE_SUBMIT_FIELD: Record<Role, string> = {
  RETAILER: "retailerSubmitted",
  WHOLESALER: "wholesalerSubmitted",
  DISTRIBUTOR: "distributorSubmitted",
  FACTORY: "factorySubmitted",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();
    const body = await request.json();
    const { quantity } = body;

    if (typeof quantity !== "number" || quantity < 0 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: "Cantidad debe ser un número entero no negativo" },
        { status: 400 }
      );
    }

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

    if (game.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "El juego no está activo" },
        { status: 400 }
      );
    }

    if (game.mode === "TEST") {
      return NextResponse.json(
        { error: "Usa el endpoint de modo Test para procesar esta ronda" },
        { status: 400 }
      );
    }

    const player = game.players.find((p) => p.sessionId === sessionId);
    if (!player || !ROLES.includes(player.role as Role)) {
      return NextResponse.json(
        { error: "Jugador no encontrado" },
        { status: 403 }
      );
    }

    if (player.isSpectator) {
      return NextResponse.json(
        { error: "Los espectadores no pueden enviar pedidos" },
        { status: 403 }
      );
    }

    const role = player.role as Role;
    const currentRound = game.currentRound;

    // Check if already submitted
    const roundRecord = await prisma.round.findUnique({
      where: { gameId_round: { gameId: game.id, round: currentRound } },
    });

    if (!roundRecord) {
      return NextResponse.json(
        { error: "Ronda no encontrada" },
        { status: 500 }
      );
    }

    if ((roundRecord as Record<string, unknown>)[ROLE_SUBMIT_FIELD[role]]) {
      return NextResponse.json(
        { error: "Ya enviaste tu pedido para esta ronda" },
        { status: 400 }
      );
    }

    // Create or update PlayerRound with the order
    await prisma.playerRound.upsert({
      where: {
        playerId_round: { playerId: player.id, round: currentRound },
      },
      update: { orderPlaced: quantity },
      create: {
        playerId: player.id,
        round: currentRound,
        orderPlaced: quantity,
      },
    });

    // Mark submission and get updated round in one operation
    const updatedRound = await prisma.round.update({
      where: { gameId_round: { gameId: game.id, round: currentRound } },
      data: { [ROLE_SUBMIT_FIELD[role]]: true },
    });

    // In SOLO mode, auto-submit bot orders after the human's order
    if (game.mode === "SOLO" && game.controllerSessionId) {
      await submitBotOrders(game.id, currentRound, game.controllerSessionId);
    }

    // Emit order submitted (role only, no quantity — information silo)
    const io = getIO();
    if (io) {
      io.to(code).emit(S2C.ORDER_SUBMITTED, { role });
      await emitAdminGameUpsert(io, code);
    }

    // Re-fetch round to see all submissions (including bots in SOLO mode)
    const finalRound = game.mode === "SOLO"
      ? await prisma.round.findUniqueOrThrow({
          where: { gameId_round: { gameId: game.id, round: currentRound } },
        })
      : updatedRound;

    // Check if all 4 have submitted
    const allSubmitted =
      finalRound.retailerSubmitted &&
      finalRound.wholesalerSubmitted &&
      finalRound.distributorSubmitted &&
      finalRound.factorySubmitted;

    if (allSubmitted) {
      await processRound(game.id, currentRound);

      if (io) {
        if (currentRound >= game.totalRounds) {
          io.to(code).emit(S2C.GAME_ENDED, {});
        } else {
          io.to(code).emit(S2C.ROUND_ADVANCED, {
            round: currentRound + 1,
          });
        }
        await emitAdminGameUpsert(io, code);
      }
    }

    return NextResponse.json({
      success: true,
      allSubmitted,
    });
  } catch (error) {
    console.error("Error al enviar pedido:", error);
    return NextResponse.json(
      { error: "Error al enviar el pedido" },
      { status: 500 }
    );
  }
}
