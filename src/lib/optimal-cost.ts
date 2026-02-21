/**
 * Compute the optimal (perfect-information) cost for the Beer Game.
 *
 * With perfect information and full coordination, the optimal strategy
 * is simple: every role orders exactly the consumer demand each round.
 * There is zero amplification (no bullwhip effect).
 *
 * The unavoidable cost comes from:
 * - Holding the starting inventory while it drains down to steady-state
 * - Brief transition costs when demand changes (pipeline still carries
 *   old quantities for a few rounds due to shipping delay)
 *
 * Pipeline initialization mirrors game-engine.ts initializeGame()
 * exactly (2 items per type, arriving rounds 1 & 2).
 *
 * The simulation mirrors game-engine.ts processRound() logic:
 *   receive shipments → receive orders → ship → place orders → costs
 */

import { ROLES, type Role } from "./types";

export interface OptimalParams {
  demandPattern: number[];
  totalRounds: number;
  startInventory: number;
  holdingCost: number;
  backlogCost: number;
  orderDelay: number;
  shippingDelay: number;
}

export interface OptimalRoundData {
  round: number;
  orderPlaced: number;
  inventoryAfter: number;
  backlogAfter: number;
  totalCostCumulative: number;
}

export interface OptimalResult {
  /** Per-role optimal data (indexed by role name) */
  perRole: Record<Role, OptimalRoundData[]>;
  /** Per-role total cost */
  perRoleTotalCost: Record<Role, number>;
  /** Sum of all 4 roles' total costs */
  totalChainCost: number;
}

// Pipeline item in the simulation
interface PipeItem {
  type: "ORDER" | "SHIPMENT" | "PRODUCTION";
  toRole: Role;
  quantity: number;
  roundDue: number;
}

// Per-role state
interface RoleState {
  inventory: number;
  backlog: number;
  totalCostCumulative: number;
}

const UPSTREAM: Record<Role, Role | "PRODUCTION"> = {
  RETAILER: "WHOLESALER",
  WHOLESALER: "DISTRIBUTOR",
  DISTRIBUTOR: "FACTORY",
  FACTORY: "PRODUCTION",
};

const DOWNSTREAM: Record<Role, Role | "CONSUMER"> = {
  RETAILER: "CONSUMER",
  WHOLESALER: "RETAILER",
  DISTRIBUTOR: "WHOLESALER",
  FACTORY: "DISTRIBUTOR",
};

export function computeOptimalCosts(params: OptimalParams): OptimalResult {
  const {
    demandPattern,
    totalRounds,
    startInventory,
    holdingCost,
    backlogCost,
    orderDelay,
    shippingDelay,
  } = params;

  const steadyDemand = demandPattern[0] ?? 4;

  // Helper: get consumer demand for any round (clamped to pattern bounds)
  function getDemand(round: number): number {
    if (round < 1) return steadyDemand;
    const idx = Math.min(round - 1, demandPattern.length - 1);
    return demandPattern[idx] ?? steadyDemand;
  }

  // Initialize role states
  const state: Record<Role, RoleState> = {} as Record<Role, RoleState>;
  for (const role of ROLES) {
    state[role] = {
      inventory: startInventory,
      backlog: 0,
      totalCostCumulative: 0,
    };
  }

  // Initialize pipeline with steady-state items — mirrors game-engine.ts
  // initializeGame() exactly: always 2 items per type (roundDue 1 & 2)
  const pipeline: PipeItem[] = [];

  // Shipments in transit TO each downstream role (arriving rounds 1 & 2)
  for (const role of ROLES) {
    const downstream = DOWNSTREAM[role];
    if (downstream !== "CONSUMER") {
      pipeline.push(
        { type: "SHIPMENT", toRole: downstream as Role, quantity: steadyDemand, roundDue: 1 },
        { type: "SHIPMENT", toRole: downstream as Role, quantity: steadyDemand, roundDue: 2 },
      );
    }
  }

  // Orders in transit TO each upstream role (arriving rounds 1 & 2)
  for (const role of ROLES) {
    const upstream = UPSTREAM[role];
    if (upstream !== "PRODUCTION") {
      pipeline.push(
        { type: "ORDER", toRole: upstream as Role, quantity: steadyDemand, roundDue: 1 },
        { type: "ORDER", toRole: upstream as Role, quantity: steadyDemand, roundDue: 2 },
      );
    }
  }

  // Factory production in transit (arriving rounds 1 & 2)
  pipeline.push(
    { type: "PRODUCTION", toRole: "FACTORY", quantity: steadyDemand, roundDue: 1 },
    { type: "PRODUCTION", toRole: "FACTORY", quantity: steadyDemand, roundDue: 2 },
  );

  // Collect round data
  const perRole: Record<Role, OptimalRoundData[]> = {} as Record<Role, OptimalRoundData[]>;
  for (const role of ROLES) {
    perRole[role] = [];
  }

  // Simulate each round
  for (let round = 1; round <= totalRounds; round++) {
    const demand = getDemand(round);

    for (const role of ROLES) {
      const rs = state[role];

      // 1. RECEIVE SHIPMENTS
      const shipmentTypes = role === "FACTORY" ? ["SHIPMENT", "PRODUCTION"] : ["SHIPMENT"];
      let incomingShipment = 0;
      for (const item of pipeline) {
        if (shipmentTypes.includes(item.type) && item.toRole === role && item.roundDue === round) {
          incomingShipment += item.quantity;
        }
      }

      // 2. RECEIVE ORDERS
      let incomingOrder: number;
      if (role === "RETAILER") {
        incomingOrder = demand;
      } else {
        // Upstream receives the downstream's order from the pipeline
        let receivedOrders = 0;
        for (const item of pipeline) {
          if (item.type === "ORDER" && item.toRole === role && item.roundDue === round) {
            receivedOrders += item.quantity;
          }
        }
        incomingOrder = receivedOrders;
      }

      // 3. SHIP
      const inventoryBefore = rs.inventory + incomingShipment;
      const totalDemandThisRound = incomingOrder + rs.backlog;
      const shipmentSent = Math.min(inventoryBefore, totalDemandThisRound);
      const inventoryAfter = inventoryBefore - shipmentSent;
      const backlogAfter = totalDemandThisRound - shipmentSent;

      // Create shipment pipeline item (downstream delivery)
      const downstream = DOWNSTREAM[role];
      if (downstream !== "CONSUMER") {
        pipeline.push({
          type: "SHIPMENT",
          toRole: downstream as Role,
          quantity: shipmentSent,
          roundDue: round + shippingDelay,
        });
      }

      // 4. PLACE ORDERS — every role orders exactly consumer demand
      const orderPlaced = demand;
      const upstream = UPSTREAM[role];
      if (upstream === "PRODUCTION") {
        pipeline.push({
          type: "PRODUCTION",
          toRole: "FACTORY",
          quantity: orderPlaced,
          roundDue: round + orderDelay + shippingDelay,
        });
      } else {
        pipeline.push({
          type: "ORDER",
          toRole: upstream as Role,
          quantity: orderPlaced,
          roundDue: round + orderDelay,
        });
      }

      // 5. COSTS
      const hCost = inventoryAfter * holdingCost;
      const bCost = backlogAfter * backlogCost;
      rs.totalCostCumulative += hCost + bCost;
      rs.inventory = inventoryAfter;
      rs.backlog = backlogAfter;

      perRole[role].push({
        round,
        orderPlaced,
        inventoryAfter,
        backlogAfter,
        totalCostCumulative: rs.totalCostCumulative,
      });
    }
  }

  // Compute totals
  const perRoleTotalCost = {} as Record<Role, number>;
  let totalChainCost = 0;
  for (const role of ROLES) {
    perRoleTotalCost[role] = state[role].totalCostCumulative;
    totalChainCost += state[role].totalCostCumulative;
  }

  return { perRole, perRoleTotalCost, totalChainCost };
}

/**
 * Simulate the full supply chain using a given per-role order schedule.
 *
 * For rounds beyond the provided schedule, each role orders exactly the
 * consumer demand (steady-state / no-bullwhip fallback).
 *
 * This is used by the benchmark system to extend a short game's strategy
 * to the full totalRounds — e.g. a player plays 10 brilliant rounds, then
 * we simulate rounds 11-36 with order=demand to get the complete cost curve.
 */
export function simulateWithOrders(
  params: OptimalParams,
  orderSchedule: Record<Role, number[]>, // orders[roundIndex] for rounds 1..N
): OptimalResult {
  const {
    demandPattern,
    totalRounds,
    startInventory,
    holdingCost,
    backlogCost,
    orderDelay,
    shippingDelay,
  } = params;

  const steadyDemand = demandPattern[0] ?? 4;

  function getDemand(round: number): number {
    if (round < 1) return steadyDemand;
    const idx = Math.min(round - 1, demandPattern.length - 1);
    return demandPattern[idx] ?? steadyDemand;
  }

  // Initialize role states
  const state: Record<Role, RoleState> = {} as Record<Role, RoleState>;
  for (const role of ROLES) {
    state[role] = {
      inventory: startInventory,
      backlog: 0,
      totalCostCumulative: 0,
    };
  }

  // Initialize pipeline — mirrors game-engine.ts exactly
  const pipeline: PipeItem[] = [];

  for (const role of ROLES) {
    const downstream = DOWNSTREAM[role];
    if (downstream !== "CONSUMER") {
      pipeline.push(
        { type: "SHIPMENT", toRole: downstream as Role, quantity: steadyDemand, roundDue: 1 },
        { type: "SHIPMENT", toRole: downstream as Role, quantity: steadyDemand, roundDue: 2 },
      );
    }
  }

  for (const role of ROLES) {
    const upstream = UPSTREAM[role];
    if (upstream !== "PRODUCTION") {
      pipeline.push(
        { type: "ORDER", toRole: upstream as Role, quantity: steadyDemand, roundDue: 1 },
        { type: "ORDER", toRole: upstream as Role, quantity: steadyDemand, roundDue: 2 },
      );
    }
  }

  pipeline.push(
    { type: "PRODUCTION", toRole: "FACTORY", quantity: steadyDemand, roundDue: 1 },
    { type: "PRODUCTION", toRole: "FACTORY", quantity: steadyDemand, roundDue: 2 },
  );

  // Collect round data
  const perRole: Record<Role, OptimalRoundData[]> = {} as Record<Role, OptimalRoundData[]>;
  for (const role of ROLES) {
    perRole[role] = [];
  }

  // Simulate each round
  for (let round = 1; round <= totalRounds; round++) {
    const demand = getDemand(round);

    for (const role of ROLES) {
      const rs = state[role];

      // 1. RECEIVE SHIPMENTS
      const shipmentTypes = role === "FACTORY" ? ["SHIPMENT", "PRODUCTION"] : ["SHIPMENT"];
      let incomingShipment = 0;
      for (const item of pipeline) {
        if (shipmentTypes.includes(item.type) && item.toRole === role && item.roundDue === round) {
          incomingShipment += item.quantity;
        }
      }

      // 2. RECEIVE ORDERS
      let incomingOrder: number;
      if (role === "RETAILER") {
        incomingOrder = demand;
      } else {
        let receivedOrders = 0;
        for (const item of pipeline) {
          if (item.type === "ORDER" && item.toRole === role && item.roundDue === round) {
            receivedOrders += item.quantity;
          }
        }
        incomingOrder = receivedOrders;
      }

      // 3. SHIP
      const inventoryBefore = rs.inventory + incomingShipment;
      const totalDemandThisRound = incomingOrder + rs.backlog;
      const shipmentSent = Math.min(inventoryBefore, totalDemandThisRound);
      const inventoryAfter = inventoryBefore - shipmentSent;
      const backlogAfter = totalDemandThisRound - shipmentSent;

      const downstream = DOWNSTREAM[role];
      if (downstream !== "CONSUMER") {
        pipeline.push({
          type: "SHIPMENT",
          toRole: downstream as Role,
          quantity: shipmentSent,
          roundDue: round + shippingDelay,
        });
      }

      // 4. PLACE ORDERS — use schedule if available, otherwise demand
      const scheduleOrders = orderSchedule[role];
      const orderPlaced = (round - 1 < scheduleOrders.length)
        ? scheduleOrders[round - 1]
        : demand;

      const upstream = UPSTREAM[role];
      if (upstream === "PRODUCTION") {
        pipeline.push({
          type: "PRODUCTION",
          toRole: "FACTORY",
          quantity: orderPlaced,
          roundDue: round + orderDelay + shippingDelay,
        });
      } else {
        pipeline.push({
          type: "ORDER",
          toRole: upstream as Role,
          quantity: orderPlaced,
          roundDue: round + orderDelay,
        });
      }

      // 5. COSTS
      const hCost = inventoryAfter * holdingCost;
      const bCost = backlogAfter * backlogCost;
      rs.totalCostCumulative += hCost + bCost;
      rs.inventory = inventoryAfter;
      rs.backlog = backlogAfter;

      perRole[role].push({
        round,
        orderPlaced,
        inventoryAfter,
        backlogAfter,
        totalCostCumulative: rs.totalCostCumulative,
      });
    }
  }

  const perRoleTotalCost = {} as Record<Role, number>;
  let totalChainCost = 0;
  for (const role of ROLES) {
    perRoleTotalCost[role] = state[role].totalCostCumulative;
    totalChainCost += state[role].totalCostCumulative;
  }

  return { perRole, perRoleTotalCost, totalChainCost };
}
