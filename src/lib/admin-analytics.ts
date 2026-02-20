import { prisma } from "@/lib/db";
import { ROLES, type Role } from "@/lib/types";

function stddev(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isoDate(date: Date | null) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export async function getGameAnalyticsByCode(code: string) {
  const game = await prisma.game.findUnique({
    where: { accessCode: code },
    include: {
      players: {
        include: {
          roundData: {
            orderBy: { round: "asc" },
          },
        },
      },
      rounds: {
        orderBy: { round: "asc" },
      },
    },
  });

  if (!game) return null;

  const playedRounds = Math.max(game.currentRound, 0);
  const demandPattern: number[] = JSON.parse(game.demandPattern);
  const demandSeries = Array.from({ length: playedRounds }, (_, index) => {
    return (
      demandPattern[index] ??
      demandPattern[demandPattern.length - 1] ??
      4
    );
  });

  const roleData = ROLES.map((role) => {
    const player = game.players.find((p) => p.role === role);
    const rounds =
      player?.roundData.filter((row) => row.round > 0 && row.orderPlaced !== null) ?? [];

    const last = rounds[rounds.length - 1];
    const orders = rounds.map((row) => row.orderPlaced ?? 0);
    const maxBacklog = rounds.reduce(
      (max, row) => Math.max(max, row.backlogAfter),
      0
    );
    const avgInventory =
      rounds.length > 0
        ? rounds.reduce((sum, row) => sum + row.inventoryAfter, 0) / rounds.length
        : 0;

    const demandStd = stddev(demandSeries);
    const roleStd = stddev(orders);
    const bullwhipIndex = demandStd === 0 ? 0 : roleStd / demandStd;

    return {
      role,
      playerId: player?.id ?? null,
      playerName: player?.name ?? "-",
      totalCost: last?.totalCostCumulative ?? 0,
      maxBacklog,
      avgInventory,
      bullwhipIndex,
      rounds,
    };
  });

  const totalChainCost = roleData.reduce((sum, row) => sum + row.totalCost, 0);
  const totalBacklogPeak = roleData.reduce((max, row) => Math.max(max, row.maxBacklog), 0);

  const roundsRows = roleData.flatMap((roleEntry) => {
    return roleEntry.rounds.map((row) => ({
      round: row.round,
      role: roleEntry.role,
      playerName: roleEntry.playerName,
      demand: demandSeries[row.round - 1] ?? 0,
      incomingOrder: row.incomingOrder,
      incomingShipment: row.incomingShipment,
      orderPlaced: row.orderPlaced ?? 0,
      shipmentSent: row.shipmentSent,
      inventoryAfter: row.inventoryAfter,
      backlogAfter: row.backlogAfter,
      holdingCost: row.holdingCost,
      backlogCost: row.backlogCost,
      totalCostCumulative: row.totalCostCumulative,
    }));
  });

  const submissionsRows = game.rounds.map((round) => ({
    round: round.round,
    retailerSubmitted: round.retailerSubmitted,
    wholesalerSubmitted: round.wholesalerSubmitted,
    distributorSubmitted: round.distributorSubmitted,
    factorySubmitted: round.factorySubmitted,
    processedAt: round.processedAt?.toISOString() ?? null,
  }));

  const pipelineRows = await prisma.pipelineItem.findMany({
    where: { gameId: game.id },
    orderBy: [{ roundPlaced: "asc" }, { roundDue: "asc" }],
  });

  return {
    game: {
      id: game.id,
      accessCode: game.accessCode,
      name: game.name,
      status: game.status,
      mode: game.mode,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      createdAt: game.createdAt.toISOString(),
      endedAt: game.endedAt?.toISOString() ?? null,
      endedReason: game.endedReason,
    },
    demandSeries,
    kpis: {
      totalChainCost,
      totalBacklogPeak,
      costsByRole: Object.fromEntries(roleData.map((row) => [row.role, row.totalCost])),
      maxBacklogByRole: Object.fromEntries(roleData.map((row) => [row.role, row.maxBacklog])),
      avgInventoryByRole: Object.fromEntries(roleData.map((row) => [row.role, row.avgInventory])),
      bullwhipByRole: Object.fromEntries(roleData.map((row) => [row.role, row.bullwhipIndex])),
    },
    roles: roleData.map((row) => ({
      role: row.role,
      playerName: row.playerName,
      totalCost: row.totalCost,
      maxBacklog: row.maxBacklog,
      avgInventory: row.avgInventory,
      bullwhipIndex: row.bullwhipIndex,
    })),
    exportData: {
      summaryRows: [
        {
          accessCode: game.accessCode,
          gameName: game.name,
          status: game.status,
          mode: game.mode,
          totalChainCost,
          totalBacklogPeak,
          currentRound: game.currentRound,
          totalRounds: game.totalRounds,
          endedReason: game.endedReason ?? "",
          endedAt: game.endedAt?.toISOString() ?? "",
        },
      ],
      roundsRows,
      submissionsRows,
      pipelineRows: pipelineRows.map((row) => ({
        type: row.type,
        fromRole: row.fromRole,
        toRole: row.toRole,
        quantity: row.quantity,
        roundPlaced: row.roundPlaced,
        roundDue: row.roundDue,
      })),
    },
  };
}

export async function getOverviewAnalytics(filters?: {
  from?: Date;
  to?: Date;
  mode?: string;
}) {
  const where: {
    status: string;
    mode?: string;
    endedAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {
    status: "COMPLETED",
  };

  if (filters?.mode && filters.mode !== "ALL") {
    where.mode = filters.mode;
  }

  if (filters?.from || filters?.to) {
    where.endedAt = {};
    if (filters.from) where.endedAt.gte = filters.from;
    if (filters.to) where.endedAt.lte = filters.to;
  }

  const games = await prisma.game.findMany({
    where,
    include: {
      players: {
        include: {
          roundData: {
            orderBy: { round: "asc" },
          },
        },
      },
    },
    orderBy: { endedAt: "desc" },
  });

  const gameRows = games.map((game) => {
    const demandPattern: number[] = JSON.parse(game.demandPattern);
    const demandSeries = Array.from({ length: game.currentRound }, (_, index) => {
      return (
        demandPattern[index] ??
        demandPattern[demandPattern.length - 1] ??
        4
      );
    });

    const roleEntries = ROLES.map((role) => {
      const player = game.players.find((p) => p.role === role);
      const roundRows =
        player?.roundData.filter((row) => row.round > 0 && row.orderPlaced !== null) ?? [];
      const last = roundRows[roundRows.length - 1];
      const demandStd = stddev(demandSeries);
      const roleStd = stddev(roundRows.map((row) => row.orderPlaced ?? 0));

      return {
        role,
        totalCost: last?.totalCostCumulative ?? 0,
        bullwhipIndex: demandStd === 0 ? 0 : roleStd / demandStd,
      };
    });

    const totalCost = roleEntries.reduce((sum, entry) => sum + entry.totalCost, 0);

    return {
      gameId: game.id,
      accessCode: game.accessCode,
      name: game.name,
      mode: game.mode,
      endedAt: game.endedAt,
      endedDate: isoDate(game.endedAt),
      totalCost,
      roleEntries,
    };
  });

  const costs = gameRows.map((row) => row.totalCost);

  const bullwhipByRole = Object.fromEntries(
    ROLES.map((role) => {
      const values = gameRows.map((row) => {
        const match = row.roleEntries.find((entry) => entry.role === role);
        return match?.bullwhipIndex ?? 0;
      });
      return [role, values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length];
    })
  ) as Record<Role, number>;

  const countsByMode = Object.fromEntries(
    ["MULTI", "TEST"].map((mode) => [
      mode,
      gameRows.filter((row) => row.mode === mode).length,
    ])
  );

  const topWorst = [...gameRows]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5)
    .map((row) => ({
      accessCode: row.accessCode,
      name: row.name,
      mode: row.mode,
      totalCost: row.totalCost,
      endedAt: row.endedAt?.toISOString() ?? null,
    }));

  const topBest = [...gameRows]
    .sort((a, b) => a.totalCost - b.totalCost)
    .slice(0, 5)
    .map((row) => ({
      accessCode: row.accessCode,
      name: row.name,
      mode: row.mode,
      totalCost: row.totalCost,
      endedAt: row.endedAt?.toISOString() ?? null,
    }));

  const byDate = new Map<string, { games: number; totalCost: number }>();
  for (const row of gameRows) {
    if (!row.endedDate) continue;
    const existing = byDate.get(row.endedDate) ?? { games: 0, totalCost: 0 };
    existing.games += 1;
    existing.totalCost += row.totalCost;
    byDate.set(row.endedDate, existing);
  }

  const trendByDay = [...byDate.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, metrics]) => ({
      date,
      games: metrics.games,
      avgCost: metrics.games === 0 ? 0 : metrics.totalCost / metrics.games,
    }));

  return {
    filters: {
      from: filters?.from?.toISOString() ?? null,
      to: filters?.to?.toISOString() ?? null,
      mode: filters?.mode ?? "ALL",
    },
    kpis: {
      totalGames: gameRows.length,
      avgCost: costs.length === 0 ? 0 : costs.reduce((sum, value) => sum + value, 0) / costs.length,
      medianCost: median(costs),
      countsByMode,
      bullwhipByRole,
    },
    topWorst,
    topBest,
    trendByDay,
    exportData: {
      gamesRows: gameRows.map((row) => ({
        accessCode: row.accessCode,
        name: row.name,
        mode: row.mode,
        endedAt: row.endedAt?.toISOString() ?? "",
        totalCost: row.totalCost,
      })),
      trendRows: trendByDay,
      kpiRows: [
        {
          totalGames: gameRows.length,
          avgCost: costs.length === 0 ? 0 : costs.reduce((sum, value) => sum + value, 0) / costs.length,
          medianCost: median(costs),
          multiGames: countsByMode.MULTI ?? 0,
          testGames: countsByMode.TEST ?? 0,
          bullwhipRetailer: bullwhipByRole.RETAILER,
          bullwhipWholesaler: bullwhipByRole.WHOLESALER,
          bullwhipDistributor: bullwhipByRole.DISTRIBUTOR,
          bullwhipFactory: bullwhipByRole.FACTORY,
        },
      ],
    },
  };
}
