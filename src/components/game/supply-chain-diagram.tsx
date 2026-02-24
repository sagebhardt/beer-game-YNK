import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Factory, ShoppingBag, ShoppingCart, Truck, Warehouse, Cog, Check, Clock } from "lucide-react";
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

function statusLabel(status: NodeStatus): { text: string; icon: "check" | "clock" } | null {
  if (status === "submitted") return { text: "Listo", icon: "check" };
  if (status === "must-play") return { text: "Tu turno", icon: "clock" };
  if (status === "pending") return { text: "Pendiente", icon: "clock" };
  return null;
}

export function SupplyChainDiagram({ playerRole, submissions, className }: SupplyChainDiagramProps) {
  const downstream = DOWNSTREAM[playerRole];
  const upstream = UPSTREAM[playerRole];

  return (
    <div className={cn("rounded-xl border border-[var(--border-soft)] bg-white px-4 py-4 sm:px-6 sm:py-5", className)}>
      {/* Flow legend */}
      <div className="mb-3 flex items-center justify-center gap-8 text-[11px] font-semibold text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-5 rounded-full bg-[var(--accent)]" />
          <span className="text-[var(--accent)]">← Pedidos</span>
          <span className="hidden sm:inline">(info aguas arriba)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-5 rounded-full bg-[var(--ok)]" />
          <span className="text-[var(--ok)]">Mercancía →</span>
          <span className="hidden sm:inline">(flujo aguas abajo)</span>
        </span>
      </div>

      {/* Chain nodes */}
      <div className="flex items-start justify-center gap-0 overflow-x-auto pb-1">
        {CHAIN.map((nodeId, idx) => {
          const Icon = NODE_ICONS[nodeId];
          const label = NODE_LABELS[nodeId];
          const isPlayer = nodeId === playerRole;
          const isRole = (ROLES as readonly string[]).includes(nodeId);
          const isEdge = nodeId === "CONSUMER" || nodeId === "PRODUCTION";
          const status = getNodeStatus(nodeId, playerRole, submissions);
          const sLabel = statusLabel(status);

          // Contextual label for adjacent nodes
          let contextLabel: string | null = null;
          if (nodeId === downstream) contextLabel = "Tu cliente";
          if (nodeId === upstream) contextLabel = "Tu proveedor";

          return (
            <div key={nodeId} className="flex items-center">
              {/* Connector arrow between nodes */}
              {idx > 0 && (
                <div className="flex w-4 flex-col items-center gap-0.5 sm:w-6">
                  <span className="text-[10px] font-bold text-[var(--ok)] sm:text-xs">›</span>
                  <span className="text-[10px] font-bold text-[var(--accent)] sm:text-xs">‹</span>
                </div>
              )}

              {/* Node */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "relative flex flex-col items-center rounded-xl border-2 px-3 py-2.5 text-center transition-all sm:px-5 sm:py-3",
                    isEdge
                      ? "border-dashed border-[var(--border-soft)] bg-[var(--bg-muted)]"
                      : status === "submitted"
                      ? "border-[#86efac] bg-[#f0fdf4] ring-2 ring-[#86efac]/30 shadow-sm"
                      : status === "must-play"
                      ? "border-[#fdba74] bg-[#fff7ed] ring-2 ring-[#fdba74]/30 shadow-md"
                      : status === "pending"
                      ? "border-[#fde68a] bg-[#fefce8]"
                      : isPlayer
                      ? "border-[var(--accent)] bg-[#eef3ff] ring-2 ring-[var(--accent)]/20 shadow-sm"
                      : "border-[var(--border-soft)] bg-white",
                    !isRole && "opacity-60"
                  )}
                >
                  {isPlayer && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white whitespace-nowrap shadow-sm">
                      Tu rol
                    </span>
                  )}
                  <Icon className={cn(
                    "h-5 w-5 sm:h-6 sm:w-6",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[#ea580c]"
                      : status === "pending" ? "text-[#ca8a04]"
                      : isPlayer ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)]"
                  )} />
                  <span className={cn(
                    "mt-1 text-[11px] font-bold leading-tight sm:text-xs",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[#ea580c]"
                      : status === "pending" ? "text-[#ca8a04]"
                      : isPlayer ? "text-[var(--accent)]"
                      : "text-[var(--text-body)]"
                  )}>
                    {label}
                  </span>
                </div>

                {/* Status label below the node */}
                {sLabel && (
                  <span className={cn(
                    "flex items-center gap-1 text-[10px] font-semibold sm:text-[11px]",
                    status === "submitted" ? "text-[var(--ok)]"
                      : status === "must-play" ? "text-[#ea580c]"
                      : "text-[#ca8a04]"
                  )}>
                    {sLabel.icon === "check"
                      ? <Check className="h-3 w-3" />
                      : <Clock className="h-3 w-3" />
                    }
                    {sLabel.text}
                  </span>
                )}

                {/* Context label */}
                {contextLabel && !sLabel && (
                  <span className="text-[10px] font-semibold text-[var(--warn)] sm:text-[11px]">{contextLabel}</span>
                )}
                {contextLabel && sLabel && (
                  <span className="text-[9px] font-medium text-[var(--text-muted)]">{contextLabel}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
