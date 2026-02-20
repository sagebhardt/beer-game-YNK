import { prisma } from "@/lib/db";
import { ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";

const ROLE_SUBMIT_FIELD: Record<Role, string> = {
  RETAILER: "retailerSubmitted",
  WHOLESALER: "wholesalerSubmitted",
  DISTRIBUTOR: "distributorSubmitted",
  FACTORY: "factorySubmitted",
};

/**
 * Initialize game state when host starts the game.
 * Creates round-0 snapshots, pre-fills pipeline with steady-state flow, and sets round to 1.
 */
export async function initializeGame(gameId: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  });

  const players = game.players.filter((p) => ROLES.includes(p.role as Role));
  if (players.length !== 4) {
    throw new Error("Se necesitan 4 jugadores con roles asignados");
  }

  const steadyFlow = 4; // standard Beer Game steady-state flow

  await prisma.$transaction(async (tx) => {
    // Create round-0 snapshot for each player (starting state)
    for (const player of players) {
      await tx.playerRound.create({
        data: {
          playerId: player.id,
          round: 0,
          inventoryBefore: game.startInventory,
          backlogBefore: 0,
          incomingOrder: 0,
          incomingShipment: 0,
          orderPlaced: 0,
          shipmentSent: 0,
          inventoryAfter: game.startInventory,
          backlogAfter: 0,
          holdingCost: 0,
          backlogCost: 0,
          totalCostCumulative: 0,
        },
      });
    }

    // Pre-fill pipeline with steady-state items already in transit
    const pipelineItems: Array<{
      gameId: string;
      type: string;
      fromRole: string;
      toRole: string;
      quantity: number;
      roundPlaced: number;
      roundDue: number;
    }> = [];

    // For each link in the chain, create shipments and orders in transit
    for (const role of ROLES) {
      const downstream = DOWNSTREAM[role];
      if (downstream === "CONSUMER") continue; // Retailer ships to consumer, no pipeline item

      // Shipments in transit TO the downstream role (arriving rounds 1 & 2)
      pipelineItems.push(
        {
          gameId,
          type: "SHIPMENT",
          fromRole: role,
          toRole: downstream,
          quantity: steadyFlow,
          roundPlaced: -1,
          roundDue: 1,
        },
        {
          gameId,
          type: "SHIPMENT",
          fromRole: role,
          toRole: downstream,
          quantity: steadyFlow,
          roundPlaced: -1,
          roundDue: 2,
        }
      );
    }

    // Orders in transit TO each upstream role (arriving rounds 1 & 2)
    for (const role of ROLES) {
      const upstream = UPSTREAM[role];
      if (upstream === "PRODUCTION") continue; // Factory has no upstream

      pipelineItems.push(
        {
          gameId,
          type: "ORDER",
          fromRole: role,
          toRole: upstream,
          quantity: steadyFlow,
          roundPlaced: -1,
          roundDue: 1,
        },
        {
          gameId,
          type: "ORDER",
          fromRole: role,
          toRole: upstream,
          quantity: steadyFlow,
          roundPlaced: -1,
          roundDue: 2,
        }
      );
    }

    // Factory production in transit (arriving rounds 1 & 2)
    pipelineItems.push(
      {
        gameId,
        type: "PRODUCTION",
        fromRole: "FACTORY",
        toRole: "FACTORY",
        quantity: steadyFlow,
        roundPlaced: -1,
        roundDue: 1,
      },
      {
        gameId,
        type: "PRODUCTION",
        fromRole: "FACTORY",
        toRole: "FACTORY",
        quantity: steadyFlow,
        roundPlaced: -1,
        roundDue: 2,
      }
    );

    for (const item of pipelineItems) {
      await tx.pipelineItem.create({ data: item });
    }

    // Create Round 1 record
    await tx.round.create({
      data: { gameId, round: 1 },
    });

    // Activate game
    await tx.game.update({
      where: { id: gameId },
      data: { status: "ACTIVE", currentRound: 1 },
    });
  });
}

/**
 * Process a round after all 4 players have submitted their orders.
 */
export async function processRound(gameId: string, roundNumber: number) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  });

  const demandPattern: number[] = JSON.parse(game.demandPattern);
  const players = game.players.filter((p) => ROLES.includes(p.role as Role));

  await prisma.$transaction(async (tx) => {
    for (const player of players) {
      const role = player.role as Role;

      // Get previous round's end state
      const prevRound = await tx.playerRound.findUniqueOrThrow({
        where: { playerId_round: { playerId: player.id, round: roundNumber - 1 } },
      });

      // Get this round's order (already saved when player submitted)
      const currentRound = await tx.playerRound.findUniqueOrThrow({
        where: { playerId_round: { playerId: player.id, round: roundNumber } },
      });

      const orderPlaced = currentRound.orderPlaced ?? 0;

      // 1. RECEIVE SHIPMENTS
      const shipmentTypes = role === "FACTORY" ? ["SHIPMENT", "PRODUCTION"] : ["SHIPMENT"];
      const incomingShipments = await tx.pipelineItem.findMany({
        where: {
          gameId,
          type: { in: shipmentTypes },
          toRole: role,
          roundDue: roundNumber,
        },
      });
      const incomingShipment = incomingShipments.reduce((sum, s) => sum + s.quantity, 0);

      // 2. RECEIVE ORDERS
      let incomingOrder: number;
      if (role === "RETAILER") {
        // Consumer demand
        incomingOrder = demandPattern[roundNumber - 1] ?? demandPattern[demandPattern.length - 1] ?? 4;
      } else {
        // Orders from downstream (that were placed orderDelay rounds ago)
        const incomingOrders = await tx.pipelineItem.findMany({
          where: {
            gameId,
            type: "ORDER",
            toRole: role,
            roundDue: roundNumber,
          },
        });
        incomingOrder = incomingOrders.reduce((sum, o) => sum + o.quantity, 0);
      }

      // 3. CALCULATE AND SHIP
      const inventoryBefore = prevRound.inventoryAfter + incomingShipment;
      const backlogBefore = prevRound.backlogAfter;
      const totalDemand = incomingOrder + backlogBefore;
      const shipmentSent = Math.min(inventoryBefore, totalDemand);
      const inventoryAfter = inventoryBefore - shipmentSent;
      const backlogAfter = totalDemand - shipmentSent;

      // Create shipment pipeline item (downstream delivery)
      const downstream = DOWNSTREAM[role];
      if (downstream !== "CONSUMER") {
        await tx.pipelineItem.create({
          data: {
            gameId,
            type: "SHIPMENT",
            fromRole: role,
            toRole: downstream,
            quantity: shipmentSent,
            roundPlaced: roundNumber,
            roundDue: roundNumber + game.shippingDelay,
          },
        });
      }

      // 4. PLACE ORDERS (create pipeline items)
      const upstream = UPSTREAM[role];
      if (upstream === "PRODUCTION") {
        // Factory: production with full lead time
        await tx.pipelineItem.create({
          data: {
            gameId,
            type: "PRODUCTION",
            fromRole: "FACTORY",
            toRole: "FACTORY",
            quantity: orderPlaced,
            roundPlaced: roundNumber,
            roundDue: roundNumber + game.orderDelay + game.shippingDelay,
          },
        });
      } else {
        // Order to upstream
        await tx.pipelineItem.create({
          data: {
            gameId,
            type: "ORDER",
            fromRole: role,
            toRole: upstream,
            quantity: orderPlaced,
            roundPlaced: roundNumber,
            roundDue: roundNumber + game.orderDelay,
          },
        });
      }

      // 5. CALCULATE COSTS
      const holdingCost = inventoryAfter * game.holdingCost;
      const backlogCostVal = backlogAfter * game.backlogCost;
      const totalCostCumulative =
        prevRound.totalCostCumulative + holdingCost + backlogCostVal;

      // 6. UPDATE PlayerRound snapshot
      await tx.playerRound.update({
        where: { playerId_round: { playerId: player.id, round: roundNumber } },
        data: {
          inventoryBefore,
          backlogBefore,
          incomingOrder,
          incomingShipment,
          shipmentSent,
          inventoryAfter,
          backlogAfter,
          holdingCost,
          backlogCost: backlogCostVal,
          totalCostCumulative,
        },
      });
    }

    // 7. MARK ROUND AS PROCESSED
    await tx.round.update({
      where: { gameId_round: { gameId, round: roundNumber } },
      data: { processedAt: new Date() },
    });

    // 8. ADVANCE OR COMPLETE
    if (roundNumber >= game.totalRounds) {
      await tx.game.update({
        where: { id: gameId },
        data: { status: "COMPLETED", currentRound: roundNumber },
      });
    } else {
      await tx.game.update({
        where: { id: gameId },
        data: { currentRound: roundNumber + 1 },
      });
      await tx.round.create({
        data: { gameId, round: roundNumber + 1 },
      });
    }
  });
}

/**
 * Get the current state visible to a specific player (respects information silos).
 */
export async function getPlayerState(gameId: string, sessionId: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  });

  const player = game.players.find((p) => p.sessionId === sessionId);
  if (!player) throw new Error("Jugador no encontrado");

  const role = player.role as Role;
  const currentRound = game.currentRound;

  // Get round history
  const roundHistory = await prisma.playerRound.findMany({
    where: { playerId: player.id },
    orderBy: { round: "asc" },
  });

  // Get pipeline items arriving to this player in the future
  const pipeline = await prisma.pipelineItem.findMany({
    where: {
      gameId,
      toRole: role,
      type: { in: role === "FACTORY" ? ["SHIPMENT", "PRODUCTION"] : ["SHIPMENT"] },
      roundDue: { gt: currentRound },
    },
    orderBy: { roundDue: "asc" },
  });

  const pipelineEntries = pipeline.map((p) => ({
    quantity: p.quantity,
    arrivesInRounds: p.roundDue - currentRound,
  }));

  // Get round submission status
  const currentRoundRecord = await prisma.round.findUnique({
    where: { gameId_round: { gameId, round: currentRound } },
  });

  const lastRound = roundHistory[roundHistory.length - 1];

  return {
    game: {
      accessCode: game.accessCode,
      name: game.name,
      status: game.status,
      currentRound,
      totalRounds: game.totalRounds,
    },
    player: {
      id: player.id,
      name: player.name,
      role,
      inventory: lastRound?.inventoryAfter ?? game.startInventory,
      backlog: lastRound?.backlogAfter ?? 0,
      totalCost: lastRound?.totalCostCumulative ?? 0,
    },
    pipeline: pipelineEntries,
    roundHistory: roundHistory
      .filter((r) => r.round > 0 && r.orderPlaced !== null)
      .map((r) => ({
        round: r.round,
        incomingOrder: r.incomingOrder,
        incomingShipment: r.incomingShipment,
        orderPlaced: r.orderPlaced ?? 0,
        shipmentSent: r.shipmentSent,
        inventoryAfter: r.inventoryAfter,
        backlogAfter: r.backlogAfter,
        holdingCost: r.holdingCost,
        backlogCost: r.backlogCost,
        totalCostCumulative: r.totalCostCumulative,
      })),
    submissions: currentRoundRecord
      ? {
          retailer: currentRoundRecord.retailerSubmitted,
          wholesaler: currentRoundRecord.wholesalerSubmitted,
          distributor: currentRoundRecord.distributorSubmitted,
          factory: currentRoundRecord.factorySubmitted,
        }
      : null,
    hasSubmittedThisRound: currentRoundRecord
      ? !!(currentRoundRecord as Record<string, unknown>)[ROLE_SUBMIT_FIELD[role]]
      : false,
    isHost: game.hostSessionId === sessionId,
  };
}

/**
 * Get full game state for the host view (no information silos).
 */
export async function getHostState(gameId: string) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: { include: { roundData: { orderBy: { round: "asc" } } } } },
  });

  const currentRoundRecord = await prisma.round.findUnique({
    where: { gameId_round: { gameId, round: game.currentRound } },
  });

  const pipeline = await prisma.pipelineItem.findMany({
    where: { gameId, roundDue: { gt: game.currentRound } },
    orderBy: { roundDue: "asc" },
  });

  const demandPattern: number[] = JSON.parse(game.demandPattern);

  return {
    game: {
      id: game.id,
      accessCode: game.accessCode,
      name: game.name,
      status: game.status,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      demandPattern,
      holdingCost: game.holdingCost,
      backlogCost: game.backlogCost,
    },
    players: game.players.map((p) => {
      const lastRound = p.roundData[p.roundData.length - 1];
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        isConnected: p.isConnected,
        inventory: lastRound?.inventoryAfter ?? game.startInventory,
        backlog: lastRound?.backlogAfter ?? 0,
        totalCost: lastRound?.totalCostCumulative ?? 0,
        roundData: p.roundData
          .filter((r) => r.round > 0 && r.orderPlaced !== null)
          .map((r) => ({
            round: r.round,
            incomingOrder: r.incomingOrder,
            incomingShipment: r.incomingShipment,
            orderPlaced: r.orderPlaced ?? 0,
            shipmentSent: r.shipmentSent,
            inventoryAfter: r.inventoryAfter,
            backlogAfter: r.backlogAfter,
            holdingCost: r.holdingCost,
            backlogCost: r.backlogCost,
            totalCostCumulative: r.totalCostCumulative,
          })),
      };
    }),
    pipeline: pipeline.map((p) => ({
      type: p.type,
      fromRole: p.fromRole,
      toRole: p.toRole,
      quantity: p.quantity,
      roundDue: p.roundDue,
      arrivesInRounds: p.roundDue - game.currentRound,
    })),
    submissions: currentRoundRecord
      ? {
          retailer: currentRoundRecord.retailerSubmitted,
          wholesaler: currentRoundRecord.wholesalerSubmitted,
          distributor: currentRoundRecord.distributorSubmitted,
          factory: currentRoundRecord.factorySubmitted,
        }
      : null,
    currentDemand: demandPattern[game.currentRound - 1] ?? demandPattern[demandPattern.length - 1] ?? 4,
  };
}
