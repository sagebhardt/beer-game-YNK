/**
 * Benchmark system — saves the best completed game for each unique
 * configuration as the reference for future comparisons.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { ROLES, type Role } from "@/lib/types";
import type { OptimalResult, OptimalRoundData } from "@/lib/optimal-cost";

interface GameConfig {
  demandPattern: string;
  totalRounds: number;
  holdingCost: number;
  backlogCost: number;
  startInventory: number;
  orderDelay: number;
  shippingDelay: number;
}

/** Deterministic hash of the 7 game-config fields. */
export function configHash(cfg: GameConfig): string {
  const payload = JSON.stringify({
    demandPattern: cfg.demandPattern,
    totalRounds: cfg.totalRounds,
    holdingCost: cfg.holdingCost,
    backlogCost: cfg.backlogCost,
    startInventory: cfg.startInventory,
    orderDelay: cfg.orderDelay,
    shippingDelay: cfg.shippingDelay,
  });
  return createHash("md5").update(payload).digest("hex");
}

/**
 * After a game completes, check if it's the new best for its config.
 * If so, save it as the benchmark.
 */
export async function maybeUpdateBenchmark(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          roundData: { orderBy: { round: "asc" } },
        },
      },
    },
  });

  if (!game || game.status !== "COMPLETED") return;

  // Compute total chain cost from player data
  let totalChainCost = 0;
  const costsByRole: Record<string, number> = {};
  const perRoleData: Record<string, OptimalRoundData[]> = {};

  for (const role of ROLES) {
    const player = game.players.find((p) => p.role === role);
    if (!player) return; // Incomplete game, skip

    const rounds = player.roundData.filter(
      (rd) => rd.round > 0 && rd.orderPlaced !== null
    );
    const last = rounds[rounds.length - 1];
    const roleCost = last?.totalCostCumulative ?? 0;

    costsByRole[role] = roleCost;
    totalChainCost += roleCost;

    perRoleData[role] = rounds.map((rd) => ({
      round: rd.round,
      orderPlaced: rd.orderPlaced ?? 0,
      inventoryAfter: rd.inventoryAfter,
      backlogAfter: rd.backlogAfter,
      totalCostCumulative: rd.totalCostCumulative,
    }));
  }

  const hash = configHash({
    demandPattern: game.demandPattern,
    totalRounds: game.totalRounds,
    holdingCost: game.holdingCost,
    backlogCost: game.backlogCost,
    startInventory: game.startInventory,
    orderDelay: game.orderDelay,
    shippingDelay: game.shippingDelay,
  });

  // Check existing benchmark
  const existing = await prisma.benchmark.findUnique({
    where: { configHash: hash },
  });

  if (existing && existing.totalChainCost <= totalChainCost) {
    return; // Current benchmark is still better
  }

  // Upsert — new best game
  await prisma.benchmark.upsert({
    where: { configHash: hash },
    create: {
      configHash: hash,
      gameCode: game.accessCode,
      totalChainCost,
      costsByRole: JSON.stringify(costsByRole),
      perRoleData: JSON.stringify(perRoleData),
      completedAt: game.endedAt ?? new Date(),
    },
    update: {
      gameCode: game.accessCode,
      totalChainCost,
      costsByRole: JSON.stringify(costsByRole),
      perRoleData: JSON.stringify(perRoleData),
      completedAt: game.endedAt ?? new Date(),
    },
  });
}

/**
 * Load the benchmark for a game's configuration.
 * Returns an OptimalResult-compatible shape, or null if no benchmark exists.
 */
export async function loadBenchmark(
  cfg: GameConfig
): Promise<OptimalResult | null> {
  const hash = configHash(cfg);
  const benchmark = await prisma.benchmark.findUnique({
    where: { configHash: hash },
  });

  if (!benchmark) return null;

  const costsByRole = JSON.parse(benchmark.costsByRole) as Record<string, number>;
  const perRoleData = JSON.parse(benchmark.perRoleData) as Record<
    string,
    OptimalRoundData[]
  >;

  return {
    perRole: perRoleData as Record<Role, OptimalRoundData[]>,
    perRoleTotalCost: costsByRole as Record<Role, number>,
    totalChainCost: benchmark.totalChainCost,
  };
}
