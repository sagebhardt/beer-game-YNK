import type { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/types";
import { getHostState } from "@/lib/game-engine";

export const ADMIN_DASHBOARD_ROOM = "admin:dashboard";
export const adminGameRoom = (code: string) => `admin:game:${code}`;

export interface AdminGameSummary {
  id: string;
  accessCode: string;
  name: string;
  status: string;
  mode: string;
  currentRound: number;
  totalRounds: number;
  playerCount: number;
  assignedRoles: number;
  updatedAt: string;
  createdAt: string;
  endedAt: string | null;
  submissions: {
    ready: number;
    total: number;
  } | null;
}

function countAssignedRoles(roles: string[]) {
  const assigned = new Set(
    roles.filter((role) => ROLES.includes(role as (typeof ROLES)[number]))
  );
  return assigned.size;
}

function toSummaryWithRound(
  game: {
    id: string;
    accessCode: string;
    name: string;
    status: string;
    mode: string;
    currentRound: number;
    totalRounds: number;
    players: Array<{ role: string }>;
    updatedAt: Date;
    createdAt: Date;
    endedAt: Date | null;
  },
  round: {
    retailerSubmitted: boolean;
    wholesalerSubmitted: boolean;
    distributorSubmitted: boolean;
    factorySubmitted: boolean;
  } | null,
): AdminGameSummary {
  const submissions = round
    ? {
        ready:
          Number(round.retailerSubmitted) +
          Number(round.wholesalerSubmitted) +
          Number(round.distributorSubmitted) +
          Number(round.factorySubmitted),
        total: 4,
      }
    : null;

  return {
    id: game.id,
    accessCode: game.accessCode,
    name: game.name,
    status: game.status,
    mode: game.mode,
    currentRound: game.currentRound,
    totalRounds: game.totalRounds,
    playerCount: game.players.length,
    assignedRoles: countAssignedRoles(game.players.map((p) => p.role)),
    updatedAt: game.updatedAt.toISOString(),
    createdAt: game.createdAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
    submissions,
  };
}

export async function getAdminGameSummaryByCode(code: string) {
  const game = await prisma.game.findUnique({
    where: { accessCode: code },
    include: {
      players: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!game) return null;

  const round = game.currentRound > 0
    ? await prisma.round.findUnique({
        where: { gameId_round: { gameId: game.id, round: game.currentRound } },
      })
    : null;

  return toSummaryWithRound(game, round);
}

export async function getAdminDashboardGames(filters?: {
  status?: string;
  mode?: string;
  q?: string;
}) {
  const where: {
    status?: string;
    mode?: string;
    OR?: Array<{ accessCode?: { contains: string }; name?: { contains: string } }>;
  } = {};

  if (filters?.status && filters.status !== "ALL") where.status = filters.status;
  if (filters?.mode && filters.mode !== "ALL") where.mode = filters.mode;

  if (filters?.q) {
    where.OR = [
      { accessCode: { contains: filters.q } },
      { name: { contains: filters.q } },
    ];
  }

  const games = await prisma.game.findMany({
    where,
    include: {
      players: {
        select: {
          role: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Batch-fetch all current round records instead of N+1
  const activeGames = games.filter((g) => g.currentRound > 0);
  const roundRecords = activeGames.length > 0
    ? await prisma.round.findMany({
        where: {
          OR: activeGames.map((g) => ({
            gameId: g.id,
            round: g.currentRound,
          })),
        },
      })
    : [];

  const roundMap = new Map(roundRecords.map((r) => [`${r.gameId}:${r.round}`, r]));

  return games.map((game) => {
    const round = roundMap.get(`${game.id}:${game.currentRound}`) ?? null;
    return toSummaryWithRound(game, round);
  });
}

export async function getAdminGameDetailByCode(code: string) {
  const game = await prisma.game.findUnique({
    where: { accessCode: code },
    select: { id: true, accessCode: true, endedReason: true, demandPresetKey: true },
  });

  if (!game) return null;

  const hostState = await getHostState(game.id);
  return {
    ...hostState,
    meta: {
      endedReason: game.endedReason,
      demandPresetKey: game.demandPresetKey,
    },
  };
}

// Debounce map: gameCode -> timeout handle
const pendingAdminEmits = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounced admin broadcast. Batches calls within 300ms so rapid-fire
 * events (e.g., 4 order submissions) only trigger one DB query + emit.
 */
export function emitAdminGameUpsert(
  io: SocketIOServer,
  code: string
) {
  const existing = pendingAdminEmits.get(code);
  if (existing) clearTimeout(existing);

  pendingAdminEmits.set(
    code,
    setTimeout(async () => {
      pendingAdminEmits.delete(code);
      try {
        const summary = await getAdminGameSummaryByCode(code);
        if (!summary) return;

        io.to(ADMIN_DASHBOARD_ROOM).emit("admin-game-upsert", summary);

        const detail = await getAdminGameDetailByCode(code);
        if (detail) {
          io.to(adminGameRoom(code)).emit("admin-game-detail", detail);
        }
      } catch (err) {
        console.error("[admin-monitor] Error emitting update for", code, err);
      }
    }, 300)
  );
}

export function emitAdminGameRemoved(io: SocketIOServer, code: string) {
  io.to(ADMIN_DASHBOARD_ROOM).emit("admin-game-removed", { code });
  io.to(adminGameRoom(code)).emit("admin-game-removed", { code });
}
