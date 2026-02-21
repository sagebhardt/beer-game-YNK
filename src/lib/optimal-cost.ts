/**
 * Compute the optimal (perfect-information) cost for the Beer Game.
 *
 * With perfect information every role knows the entire future demand
 * pattern. The optimal strategy uses **inventory-position targeting**:
 * each role computes the total demand it will face over the next L
 * rounds (where L = orderDelay + shippingDelay is the replenishment
 * lead time) and orders just enough to bring its inventory position
 * (on-hand + in-pipeline - backlog) up to that target.
 *
 * This avoids both over-ordering (which builds costly inventory) and
 * under-ordering (which causes costly backlogs).
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

  // Replenishment lead time
  const leadTime = orderDelay + shippingDelay;

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

  // Helper: sum pipeline shipments arriving for a role from roundStart to roundEnd (inclusive)
  function pendingShipments(role: Role, roundStart: number, roundEnd: number): number {
    const types = role === "FACTORY" ? ["SHIPMENT", "PRODUCTION"] : ["SHIPMENT"];
    let total = 0;
    for (const item of pipeline) {
      if (
        types.includes(item.type) &&
        item.toRole === role &&
        item.roundDue >= roundStart &&
        item.roundDue <= roundEnd
      ) {
        total += item.quantity;
      }
    }
    return total;
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

      // 4. PLACE ORDERS — inventory-position targeting
      //
      // Compute what we need to cover demand over the lead time window.
      // An order placed NOW arrives on round (round + leadTime).
      // We need enough stock to cover demand from (round+1) to (round + leadTime).
      //
      // Inventory position = inventoryAfter - backlogAfter + pending shipments
      // Target = sum of demand from (round+1) to (round + leadTime)
      // Order = max(0, target - inventoryPosition)

      // Sum demand we need to cover until the order arrives
      let demandOverLeadTime = 0;
      for (let r = round + 1; r <= round + leadTime; r++) {
        demandOverLeadTime += getDemand(r);
      }

      // Inventory position: what we have + what's coming - what we owe
      const inPipeline = pendingShipments(role, round + 1, round + leadTime);
      const inventoryPosition = inventoryAfter - backlogAfter + inPipeline;

      const orderPlaced = Math.max(0, demandOverLeadTime - inventoryPosition);

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
