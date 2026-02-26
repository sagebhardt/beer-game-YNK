import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Factory, ShoppingBag, ShoppingCart, Truck, Warehouse, Cog, Check, Clock, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
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
  gameMode?: string;
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

const CHAIN = ["PRODUCTION", "FACTORY", "DISTRIBUTOR", "WHOLESALER", "RETAILER", "CONSUMER"] as const;

type NodeStatus = "submitted" | "must-play" | "pending" | null;

function getNodeStatus(
  nodeId: string,
  playerRole: Role,
  submissions?: SubmissionStatus | null,
  gameMode?: string
): NodeStatus {
  const isRole = (ROLES as readonly string[]).includes(nodeId);
  if (!isRole) return null;

  // In SOLO/TEST mode, bots auto-play.
  // Downstream roles (left of player) already played → "submitted"
  // Upstream roles (right of player) wait for player → "pending"
  if ((gameMode === "SOLO" || gameMode === "TEST") && nodeId !== playerRole) {
    const playerIdx = CHAIN.indexOf(playerRole);
    const nodeIdx = CHAIN.indexOf(nodeId as (typeof CHAIN)[number]);
    if (nodeIdx > playerIdx) return "submitted";
    return "pending";
  }

  if (!submissions) {
    return nodeId === playerRole ? "must-play" : "pending";
  }

  const roleKey = nodeId.toLowerCase() as keyof SubmissionStatus;
  if (submissions[roleKey]) return "submitted";
  if (nodeId === playerRole) return "must-play";
  return "pending";
}

function statusLabel(status: NodeStatus): { text: string; icon: "check" | "clock" } | null {
  if (status === "submitted") return { text: "Listo", icon: "check" };
  if (status === "must-play") return { text: "Tu turno", icon: "clock" };
  if (status === "pending") return { text: "Pendiente", icon: "clock" };
  return null;
}

export function SupplyChainDiagram({ playerRole, submissions, gameMode, className }: SupplyChainDiagramProps) {
  const downstream = DOWNSTREAM[playerRole];
  const upstream = UPSTREAM[playerRole];

  return (
    <div className={cn("rounded-xl border border-[var(--border-soft)] bg-white px-4 py-5 sm:px-8 sm:py-6", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-[var(--text-strong)]">
        <RefreshCw className="h-5 w-5" />
        Diagrama de la cadena de valor
      </h3>

      {/* Flow legend */}
      <div className="mb-4 flex items-center justify-center gap-8 text-xs font-semibold text-[var(--text-muted)] sm:gap-10 sm:text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-6 rounded-full bg-[var(--accent)]" />
          <ArrowLeft className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="text-[var(--accent)]">Pedidos</span>
          <span className="hidden sm:inline text-[var(--text-muted)]">(info aguas arriba)</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-6 rounded-full bg-[var(--cta)]" />
          <span className="text-[var(--cta)]">Mercancía</span>
          <ArrowRight className="h-3.5 w-3.5 text-[var(--cta)]" />
          <span className="hidden sm:inline text-[var(--text-muted)]">(flujo aguas abajo)</span>
        </span>
      </div>

      {/* Chain nodes */}
      <div className="flex items-start justify-center gap-0 overflow-x-auto pt-4 pb-1">
        {CHAIN.map((nodeId, idx) => {
          const Icon = NODE_ICONS[nodeId];
          const label = NODE_LABELS[nodeId];
          const isPlayer = nodeId === playerRole;
          const isRole = (ROLES as readonly string[]).includes(nodeId);
          const isEdge = nodeId === "CONSUMER" || nodeId === "PRODUCTION";
          const status = getNodeStatus(nodeId, playerRole, submissions, gameMode);
          const sLabel = statusLabel(status);

          // Contextual label for adjacent nodes
          let contextLabel: string | null = null;
          if (nodeId === downstream) contextLabel = "Tu cliente";
          if (nodeId === upstream) contextLabel = "Tu proveedor";

          return (
            <div key={nodeId} className="flex items-start">
              {/* Connector between nodes */}
              {idx > 0 && (
                <div className="mt-5 flex w-5 flex-col items-center gap-0.5 sm:mt-6 sm:w-8">
                  <ArrowRight className="h-3 w-3 text-[var(--cta)] sm:h-3.5 sm:w-3.5" />
                  <ArrowLeft className="h-3 w-3 text-[var(--accent)] sm:h-3.5 sm:w-3.5" />
                </div>
              )}

              {/* Node */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "relative flex flex-col items-center rounded-xl border-2 px-4 py-3 text-center transition-all sm:px-6 sm:py-4",
                    isEdge
                      ? "border-dashed border-[var(--border-soft)] bg-[var(--bg-muted)]"
                      : status === "submitted"
                      ? "border-[#86efac] bg-[#f0fdf4] ring-2 ring-[#86efac]/30 shadow-sm"
                      : status === "must-play"
                      ? "border-[var(--cta-light-border)] bg-[var(--cta-light)] ring-2 ring-[var(--cta)]/20 shadow-md"
                      : status === "pending"
                      ? "border-[#fde68a] bg-[#fefce8]"
                      : "border-[var(--border-soft)] bg-white",
                    !isRole && "opacity-60"
                  )}
                >
                  {isPlayer && (
                    <span className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap shadow-sm",
                      status === "submitted" ? "bg-[var(--ok)]" : "bg-[var(--cta)]"
                    )}>
                      Tu rol
                    </span>
                  )}
                  <Icon className={cn(
                    "h-6 w-6 sm:h-8 sm:w-8",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[var(--cta)]"
                      : status === "pending" ? "text-[#ca8a04]"
                      : "text-[var(--text-muted)]"
                  )} />
                  <span className={cn(
                    "mt-1 text-xs font-bold leading-tight sm:text-sm",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[var(--cta)]"
                      : status === "pending" ? "text-[#ca8a04]"
                      : "text-[var(--text-body)]"
                  )}>
                    {label}
                  </span>
                </div>

                {/* Status label below the node */}
                {sLabel && (
                  <span className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold sm:text-xs",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[var(--cta)]"
                      : "text-[#ca8a04]"
                  )}>
                    {sLabel.icon === "check"
                      ? <Check className="h-3.5 w-3.5" />
                      : <Clock className="h-3.5 w-3.5" />
                    }
                    {sLabel.text}
                  </span>
                )}

                {/* Context label */}
                {contextLabel && !sLabel && (
                  <span className="text-[11px] font-semibold text-[var(--warn)] sm:text-xs">{contextLabel}</span>
                )}
                {contextLabel && sLabel && (
                  <span className="text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">{contextLabel}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
