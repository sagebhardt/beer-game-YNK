import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { generateAccessCode } from "@/lib/access-code";
import { DEMAND_PRESETS, GAME_MODES, ROLES, ROLE_LABELS } from "@/lib/types";
import { initializeGame } from "@/lib/game-engine";
import { getIO } from "@/lib/socket-server";
import { emitAdminGameUpsert } from "@/lib/admin-monitor";

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();

    const {
      name = "",
      totalRounds = 36,
      mode = "MULTI",
      holdingCost = 0.5,
      backlogCost = 1.0,
      startInventory = 12,
      playerName = "Anfitrión",
    } = body;

    if (!GAME_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "Modo de juego inválido" },
        { status: 400 }
      );
    }

    // Validate
    if (totalRounds < 4 || totalRounds > 100) {
      return NextResponse.json(
        { error: "Las rondas deben estar entre 4 y 100" },
        { status: 400 }
      );
    }

    // Public creation always uses hidden default demand.
    const demandPresetKey = "classic";
    const demandPatternArray = [...(DEMAND_PRESETS[demandPresetKey]?.pattern ?? DEMAND_PRESETS.classic.pattern)];

    // Ensure demand pattern is at least as long as totalRounds
    while (demandPatternArray.length < totalRounds) {
      demandPatternArray.push(demandPatternArray[demandPatternArray.length - 1]);
    }

    const accessCode = await generateAccessCode();

    const game = await prisma.game.create({
      data: {
        accessCode,
        name,
        mode,
        totalRounds,
        demandPresetKey,
        demandPattern: JSON.stringify(demandPatternArray),
        holdingCost,
        backlogCost,
        startInventory,
        hostSessionId: sessionId,
        controllerSessionId: mode === "TEST" ? sessionId : null,
        players: {
          create:
            mode === "TEST"
              ? ROLES.map((role) => ({
                  name: `${playerName} (${ROLE_LABELS[role]})`,
                  sessionId: `${sessionId}:${role}`,
                  role,
                }))
              : {
                  name: playerName,
                  sessionId,
                  role: "",
                },
        },
      },
      include: { players: true },
    });

    if (mode === "TEST") {
      await initializeGame(game.id);
    }

    const io = getIO();
    if (io) {
      await emitAdminGameUpsert(io, accessCode);
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error al crear juego:", error);
    return NextResponse.json(
      { error: "Error al crear el juego" },
      { status: 500 }
    );
  }
}
