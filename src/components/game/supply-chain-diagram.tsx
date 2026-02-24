import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Factory, ShoppingBag, ShoppingCart, Truck, Warehouse, Cog } from "lucide-react";
import type { ComponentType } from "react";

interface SubmissionStatus {
  retailer: boolean;
  wholesaler: boolean;
  distributor: boolean;
  factory: boolean;
}

interface SupplyChainDiagramProps {
  playerRole: Role;
  submissions?: SubmissionStatus | null;
  className?: string;
}

const NODE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  CONSUMER: ShoppingCart,
  RETAILER: ShoppingBag,
  WHOLESALER: Warehouse,
  DISTRIBUTOR: Truck,
  FACTORY: Factory,
  PRODUCTION: Cog,
};

const NODE_LABELS: Record<string, string> = {
  CONSUMER: "Consumidor",
  RETAILER: ROLE_LABELS.RETAILER,
  WHOLESALER: ROLE_LABELS.WHOLESALER,
  DISTRIBUTOR: ROLE_LABELS.DISTRIBUTOR,
  FACTORY: ROLE_LABELS.FACTORY,
  PRODUCTION: "Producción",
};

const CHAIN = ["CONSUMER", "RETAILER", "WHOLESALER", "DISTRIBUTOR", "FACTORY", "PRODUCTION"] as const;

type NodeStatus = "submitted" | "must-play" | "pending" | null;

function getNodeStatus(
  nodeId: string,
  playerRole: Role,
  submissions?: SubmissionStatus | null
): NodeStatus {
  if (!submissions) return null;
  const isRole = (ROLES as readonly string[]).includes(nodeId);
  if (!isRole) return null;

  const roleKey = nodeId.toLowerCase() as keyof SubmissionStatus;
  if (submissions[roleKey]) return "submitted";
  if (nodeId === playerRole) return "must-play";
  return "pending";
}

export function SupplyChainDiagram({ playerRole, submissions, className }: SupplyChainDiagramProps) {
  const downstream = DOWNSTREAM[playerRole];
  const upstream = UPSTREAM[playerRole];

  return (
    <div className={cn("rounded-xl border border-[var(--border-soft)] bg-white px-3 py-3", className)}>
      {/* Flow legend */}
      <div className="mb-2 flex items-center justify-center gap-6 text-[10px] font-semibold text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[var(--accent)]" />
          <span className="text-[var(--accent)]">← Pedidos</span>
          <span>(info aguas arriba)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[var(--ok)]" />
          <span className="text-[var(--ok)]">Mercancía →</span>
          <span>(flujo aguas abajo)</span>
        </span>
      </div>

      {/* Chain nodes */}
      <div className="flex min-w-max items-center justify-center gap-1">
        {CHAIN.map((nodeId, idx) => {
          const Icon = NODE_ICONS[nodeId];
          const label = NODE_LABELS[nodeId];
          const isPlayer = nodeId === playerRole;
          const isRole = (ROLES as readonly string[]).includes(nodeId);
          const isEdge = nodeId === "CONSUMER" || nodeId === "PRODUCTION";
          const status = getNodeStatus(nodeId, playerRole, submissions);

          // Contextual label for adjacent nodes
          let contextLabel: string | null = null;
          if (nodeId === downstream) contextLabel = "Tu cliente";
          if (nodeId === upstream) contextLabel = "Tu proveedor";

          return (
            <div key={nodeId} className="flex items-center gap-1">
              {idx > 0 && (
                <div className="flex flex-col items-center gap-0.5 px-0.5">
                  <span className="text-[9px] text-[var(--ok)]">→</span>
                  <span className="text-[9px] text-[var(--accent)]">←</span>
                </div>
              )}
              <div
                className={cn(
                  "relative flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition-all",
                  isEdge
                    ? "border-dashed border-[var(--border-soft)] bg-[var(--bg-muted)]"
                    : status === "submitted"
                    ? "border-[#86efac] bg-[#f0fdf4] ring-2 ring-[#86efac]/40"
                    : status === "must-play"
                    ? "border-[#fdba74] bg-[#fff7ed] ring-2 ring-[#fdba74]/40 shadow-sm"
                    : status === "pending"
                    ? "border-[#fde68a] bg-[#fefce8]"
                    : isPlayer
                    ? "border-[var(--accent)] bg-[#eef3ff] ring-2 ring-[var(--accent)]/30 shadow-sm"
                    : "border-[var(--border-soft)] bg-white",
                  !isRole && "opacity-70"
                )}
              >
                {isPlayer && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-1.5 py-px text-[9px] font-bold text-white whitespace-nowrap">
                    TU ROL
                  </span>
                )}
                <Icon className={cn(
                  "h-4 w-4",
                  status === "submitted" ? "text-[var(--ok)]"
                    : status === "must-play" ? "text-[#ea580c]"
                    : status === "pending" ? "text-[#ca8a04]"
                    : isPlayer ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)]"
                )} />
                <span className={cn(
                  "mt-0.5 text-[10px] font-semibold leading-tight",
                  status === "submitted" ? "text-[var(--ok)]"
                    : status === "must-play" ? "text-[#ea580c]"
                    : status === "pending" ? "text-[#ca8a04]"
                    : isPlayer ? "text-[var(--accent)]"
                    : "text-[var(--text-body)]"
                )}>
                  {label}
                </span>
                {contextLabel && (
                  <span className="mt-0.5 text-[9px] font-medium text-[var(--warn)]">{contextLabel}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
