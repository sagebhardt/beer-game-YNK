/**
 * Compute the optimal (perfect-information) cost for the Beer Game.
 *
 * Assumes every role knows the exact consumer demand each round and
 * orders exactly that amount. The pipeline delays still apply, so
 * inventory can fluctuate during demand transitions — but there is
 * zero amplification (no bullwhip effect).
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

  // Initialize role states
  const state: Record<Role, RoleState> = {} as Record<Role, RoleState>;
  for (const role of ROLES) {
    state[role] = {
      inventory: startInventory,
      backlog: 0,
      totalCostCumulative: 0,
    };
  }

  // Initialize pipeline with steady-state items (mirrors initializeGame)
  const pipeline: PipeItem[] = [];

  // Pre-fill shipments in transit (2 per link, arriving rounds 1 & 2)
  for (const role of ROLES) {
    const downstream = DOWNSTREAM[role];
    if (downstream !== "CONSUMER") {
      for (let r = 1; r <= shippingDelay; r++) {
        pipeline.push({
          type: "SHIPMENT",
          toRole: downstream,
          quantity: steadyDemand,
          roundDue: r,
        });
      }
    }
  }

  // Pre-fill orders in transit
  for (const role of ROLES) {
    const upstream = UPSTREAM[role];
    if (upstream !== "PRODUCTION") {
      for (let r = 1; r <= orderDelay; r++) {
        pipeline.push({
          type: "ORDER",
          toRole: upstream,
          quantity: steadyDemand,
          roundDue: r,
        });
      }
    }
  }

  // Pre-fill factory production in transit
  for (let r = 1; r <= orderDelay + shippingDelay; r++) {
    pipeline.push({
      type: "PRODUCTION",
      toRole: "FACTORY",
      quantity: steadyDemand,
      roundDue: r,
    });
  }

  // Collect round data
  const perRole: Record<Role, OptimalRoundData[]> = {} as Record<Role, OptimalRoundData[]>;
  for (const role of ROLES) {
    perRole[role] = [];
  }

  // Simulate each round
  for (let round = 1; round <= totalRounds; round++) {
    const demand =
      demandPattern[round - 1] ?? demandPattern[demandPattern.length - 1] ?? 4;

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

      // 2. RECEIVE ORDERS — with perfect info, every role sees the consumer demand
      let incomingOrder: number;
      if (role === "RETAILER") {
        incomingOrder = demand;
      } else {
        // In optimal scenario, upstream receives the downstream's order
        // which is exactly the demand (since downstream ordered demand)
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
      const totalDemand = incomingOrder + rs.backlog;
      const shipmentSent = Math.min(inventoryBefore, totalDemand);
      const inventoryAfter = inventoryBefore - shipmentSent;
      const backlogAfter = totalDemand - shipmentSent;

      // Create shipment pipeline item (downstream delivery)
      const downstream = DOWNSTREAM[role];
      if (downstream !== "CONSUMER") {
        pipeline.push({
          type: "SHIPMENT",
          toRole: downstream,
          quantity: shipmentSent,
          roundDue: round + shippingDelay,
        });
      }

      // 4. PLACE ORDERS — optimal: order exactly the consumer demand
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
          toRole: upstream,
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
