import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { getPlayerState, getHostState } from "@/lib/game-engine";
import { isAdminSession } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sessionId = await getSessionId();
    const adminSession = await isAdminSession();

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
          mode: game.mode,
          totalRounds: game.totalRounds,
        },
        players: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          isConnected: p.isConnected,
          isSpectator: p.isSpectator,
        })),
        isHost,
        currentPlayer: player
          ? { id: player.id, name: player.name, role: player.role, isSpectator: player.isSpectator }
          : null,
      });
    }

    // If game is active or completed
    const isController =
      game.mode === "TEST" && game.controllerSessionId === sessionId;

    if (!player && !isController) {
      return NextResponse.json(
        { error: "No estás en este juego" },
        { status: 403 }
      );
    }

    // TEST mode controller → full host view
    if (isController) {
      const hostState = await getHostState(game.id);
      const { demandPattern: _hiddenPattern, ...safeGame } = hostState.game;
      const { currentDemand: _hiddenDemand, ...safeHostState } = hostState;
      if (adminSession) {
        return NextResponse.json({
          ...hostState,
          isHost,
          isController,
          isAdmin: true,
        });
      }
      return NextResponse.json({
        ...safeHostState,
        game: safeGame,
        isHost,
        isController,
      });
    }

    // Spectators → full host view (demand hidden)
    if (player?.isSpectator) {
      const hostState = await getHostState(game.id);
      const { demandPattern: _hiddenPattern, ...safeGame } = hostState.game;
      const { currentDemand: _hiddenDemand, ...safeHostState } = hostState;
      return NextResponse.json({
        ...safeHostState,
        game: safeGame,
        isSpectator: true,
      });
    }

    // Regular players (including host) → siloed player view
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
