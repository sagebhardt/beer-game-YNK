import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { processRound } from "@/lib/game-engine";
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

function normalizeOrders(input: unknown): Record<Role, number> | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as Record<string, unknown>;
  const orders = (candidate.orders ?? candidate) as Record<string, unknown>;
  const normalized: Partial<Record<Role, number>> = {};

  for (const role of ROLES) {
    const value = orders[role];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return null;
    }
    normalized[role] = value;
  }

  return normalized as Record<Role, number>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();
    const body = await request.json();

    const orders = normalizeOrders(body);
    if (!orders) {
      return NextResponse.json(
        { error: "Debes enviar un pedido entero no negativo para cada rol" },
        { status: 400 }
      );
    }

    const game = await prisma.game.findUnique({
      where: { accessCode: code },
      include: {
        players: {
          select: { id: true, role: true },
        },
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

    if (game.status !== "ACTIVE") {
      return NextResponse.json({ error: "El juego no está activo" }, { status: 400 });
    }

    const rolePlayers = Object.fromEntries(
      game.players
        .filter((player) => ROLES.includes(player.role as Role))
        .map((player) => [player.role, player])
    ) as Partial<Record<Role, { id: string; role: string }>>;

    for (const role of ROLES) {
      if (!rolePlayers[role]) {
        return NextResponse.json(
          { error: `Falta jugador para el rol ${role}` },
          { status: 500 }
        );
      }
    }

    const currentRound = game.currentRound;

    const roundRecord = await prisma.round.findUnique({
      where: { gameId_round: { gameId: game.id, round: currentRound } },
    });

    if (!roundRecord) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 500 });
    }

    await prisma.$transaction(async (tx) => {
      for (const role of ROLES) {
        const player = rolePlayers[role]!;
        const quantity = orders[role];

        await tx.playerRound.upsert({
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
      }

      await tx.round.update({
        where: { gameId_round: { gameId: game.id, round: currentRound } },
        data: {
          retailerSubmitted: true,
          wholesalerSubmitted: true,
          distributorSubmitted: true,
          factorySubmitted: true,
        },
      });
    });

    await processRound(game.id, currentRound);

    const updatedGame = await prisma.game.findUniqueOrThrow({
      where: { id: game.id },
    });

    const io = getIO();
    if (io) {
      for (const role of ROLES) {
        io.to(code).emit(S2C.ORDER_SUBMITTED, { role });
      }

      if (updatedGame.status === "COMPLETED") {
        io.to(code).emit(S2C.GAME_ENDED, {});
      } else {
        io.to(code).emit(S2C.ROUND_ADVANCED, {
          round: updatedGame.currentRound,
        });
      }

      await emitAdminGameUpsert(io, code);
    }

    return NextResponse.json({
      success: true,
      round: updatedGame.currentRound,
      status: updatedGame.status,
      submitted: Object.fromEntries(
        ROLES.map((role) => [ROLE_SUBMIT_FIELD[role], true])
      ),
    });
  } catch (error) {
    console.error("Error al procesar ronda test:", error);
    return NextResponse.json(
      { error: "Error al procesar la ronda en modo test" },
      { status: 500 }
    );
  }
}
