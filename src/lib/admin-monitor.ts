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

async function getSubmissionSummary(gameId: string, currentRound: number) {
  if (currentRound <= 0) return null;

  const round = await prisma.round.findUnique({
    where: { gameId_round: { gameId, round: currentRound } },
  });

  if (!round) return null;

  const ready =
    Number(round.retailerSubmitted) +
    Number(round.wholesalerSubmitted) +
    Number(round.distributorSubmitted) +
    Number(round.factorySubmitted);

  return {
    ready,
    total: 4,
  };
}

async function toSummary(game: {
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
}): Promise<AdminGameSummary> {
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
    submissions: await getSubmissionSummary(game.id, game.currentRound),
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
  return toSummary(game);
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

  return Promise.all(games.map((game) => toSummary(game)));
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

export async function emitAdminGameUpsert(
  io: SocketIOServer,
  code: string
) {
  const summary = await getAdminGameSummaryByCode(code);
  if (!summary) return;

  io.to(ADMIN_DASHBOARD_ROOM).emit("admin-game-upsert", summary);

  const detail = await getAdminGameDetailByCode(code);
  if (detail) {
    io.to(adminGameRoom(code)).emit("admin-game-detail", detail);
  }
}

export function emitAdminGameRemoved(io: SocketIOServer, code: string) {
  io.to(ADMIN_DASHBOARD_ROOM).emit("admin-game-removed", { code });
  io.to(adminGameRoom(code)).emit("admin-game-removed", { code });
}
