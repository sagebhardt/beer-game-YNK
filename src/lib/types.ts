export const ROLES = ["RETAILER", "WHOLESALER", "DISTRIBUTOR", "FACTORY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  RETAILER: "Minorista",
  WHOLESALER: "Mayorista",
  DISTRIBUTOR: "Distribuidor",
  FACTORY: "Fábrica",
};

export const UPSTREAM: Record<Role, Role | "PRODUCTION"> = {
  RETAILER: "WHOLESALER",
  WHOLESALER: "DISTRIBUTOR",
  DISTRIBUTOR: "FACTORY",
  FACTORY: "PRODUCTION",
};

export const DOWNSTREAM: Record<Role, Role | "CONSUMER"> = {
  FACTORY: "DISTRIBUTOR",
  DISTRIBUTOR: "WHOLESALER",
  WHOLESALER: "RETAILER",
  RETAILER: "CONSUMER",
};

export const GAME_STATUS = ["LOBBY", "ACTIVE", "COMPLETED"] as const;
export type GameStatus = (typeof GAME_STATUS)[number];
export const GAME_MODES = ["MULTI", "TEST"] as const;
export type GameMode = (typeof GAME_MODES)[number];
export const GAME_ENDED_REASONS = [
  "NATURAL",
  "ADMIN_TERMINATED",
  "ADMIN_CLOSED",
] as const;
export type GameEndedReason = (typeof GAME_ENDED_REASONS)[number];

export interface PlayerState {
  role: Role;
  name: string;
  inventory: number;
  backlog: number;
  totalCost: number;
  incomingOrder: number;
  incomingShipment: number;
  pipeline: PipelineEntry[];
  hasSubmittedThisRound: boolean;
}

export interface PipelineEntry {
  quantity: number;
  arrivesInRounds: number;
}

export interface RoundSubmissionStatus {
  retailer: boolean;
  wholesaler: boolean;
  distributor: boolean;
  factory: boolean;
}

export interface RoundHistoryEntry {
  round: number;
  incomingOrder: number;
  incomingShipment: number;
  orderPlaced: number;
  shipmentSent: number;
  inventoryAfter: number;
  backlogAfter: number;
  holdingCost: number;
  backlogCost: number;
  totalCostCumulative: number;
}

export const DEMAND_PRESETS: Record<
  string,
  { label: string; description: string; pattern: number[] }
> = {
  classic: {
    label: "Clásico (Escalón)",
    description: "4 unidades por 4 semanas, luego sube a 8",
    pattern: [
      4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
    ],
  },
  steady: {
    label: "Estable",
    description: "Demanda constante de 4 unidades",
    pattern: Array(36).fill(4),
  },
  ramp: {
    label: "Gradual",
    description: "Aumenta 1 unidad cada 4 semanas",
    pattern: [
      4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9,
      9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12,
    ],
  },
  spike: {
    label: "Pico",
    description: "Pico repentino a 16 en semana 5, luego vuelve a 4",
    pattern: [
      4, 4, 4, 4, 16, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    ],
  },
  seasonal: {
    label: "Estacional",
    description: "Demanda oscila entre 2 y 10",
    pattern: [
      4, 6, 8, 10, 10, 8, 6, 4, 2, 2, 4, 6, 8, 10, 10, 8, 6, 4, 2, 2, 4, 6,
      8, 10, 10, 8, 6, 4, 2, 2, 4, 6, 8, 10, 10, 8,
    ],
  },
};
