import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { generateAccessCode } from "@/lib/access-code";
import { DEMAND_PRESETS } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const body = await request.json();

    const {
      name = "",
      totalRounds = 36,
      demandPreset = "classic",
      demandPattern: customPattern,
      holdingCost = 0.5,
      backlogCost = 1.0,
      startInventory = 12,
      playerName = "Anfitrión",
    } = body;

    // Validate
    if (totalRounds < 4 || totalRounds > 100) {
      return NextResponse.json(
        { error: "Las rondas deben estar entre 4 y 100" },
        { status: 400 }
      );
    }

    // Determine demand pattern
    let demandPatternArray: number[];
    if (customPattern) {
      if (!Array.isArray(customPattern) || customPattern.some((v: unknown) => typeof v !== "number" || v < 0)) {
        return NextResponse.json(
          { error: "Patrón de demanda inválido" },
          { status: 400 }
        );
      }
      demandPatternArray = customPattern;
    } else {
      demandPatternArray = DEMAND_PRESETS[demandPreset]?.pattern ?? DEMAND_PRESETS.classic.pattern;
    }

    // Ensure demand pattern is at least as long as totalRounds
    while (demandPatternArray.length < totalRounds) {
      demandPatternArray.push(demandPatternArray[demandPatternArray.length - 1]);
    }

    const accessCode = await generateAccessCode();

    const game = await prisma.game.create({
      data: {
        accessCode,
        name,
        totalRounds,
        demandPattern: JSON.stringify(demandPatternArray),
        holdingCost,
        backlogCost,
        startInventory,
        hostSessionId: sessionId,
        players: {
          create: {
            name: playerName,
            sessionId,
            role: "",
          },
        },
      },
      include: { players: true },
    });

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error al crear juego:", error);
    return NextResponse.json(
      { error: "Error al crear el juego" },
      { status: 500 }
    );
  }
}
