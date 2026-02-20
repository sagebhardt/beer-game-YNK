import { ROLE_LABELS, ROLES, type ChainNodeViewModel, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";
import { Factory, ShoppingBag, Truck, User, Warehouse } from "lucide-react";

interface SupplyChainStripProps {
  currentRole?: Role | null;
  statuses?: Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>;
  statusText?: Partial<Record<Role, string>>;
  inTransit?: Partial<Record<Role, number>>;
  className?: string;
}

const ROLE_ICONS: Record<Role, ComponentType<{ className?: string }>> = {
  RETAILER: ShoppingBag,
  WHOLESALER: Warehouse,
  DISTRIBUTOR: Truck,
  FACTORY: Factory,
};

function toneClasses(tone?: ChainNodeViewModel["statusTone"]) {
  switch (tone) {
    case "ok":
      return "border-[#c7f2d6] bg-[#f0fdf5] text-[var(--ok)]";
    case "warn":
      return "border-[#fde7bc] bg-[#fff8e8] text-[var(--warn)]";
    case "danger":
      return "border-[#f7ccd5] bg-[#fff1f4] text-[var(--danger)]";
    default:
      return "border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]";
  }
}

export function SupplyChainStrip({
  currentRole,
  statuses,
  statusText,
  inTransit,
  className,
}: SupplyChainStripProps) {
  const nodes: ChainNodeViewModel[] = ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    active: currentRole === role,
    statusTone: statuses?.[role] ?? "neutral",
    statusText: statusText?.[role],
    transitToNext: inTransit?.[role],
  }));

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-white px-3 py-3", className)}>
      <div className="flex min-w-max items-stretch gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-soft)] px-3 text-xs font-semibold text-[var(--text-muted)]">
          <User className="h-3.5 w-3.5" />
          Consumidor
        </div>
        {nodes.map((node, index) => (
          <div key={node.role} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">→</span>
            <div className={cn("min-w-[138px] rounded-lg border px-2.5 py-2", toneClasses(node.statusTone), node.active ? "ring-2 ring-[#c6d8ff]" : "") }>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold leading-none">
                <RoleBadgeIcon role={node.role} />
                {node.label}
              </p>
              <p className="mt-1 text-[11px]">
                {node.statusText || (node.active ? "Tu rol" : "Operativo")}
              </p>
            </div>
            {index < nodes.length - 1 && typeof node.transitToNext === "number" ? (
              <span className="rounded border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                {node.transitToNext} en tránsito
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleBadgeIcon({ role }: { role: Role }) {
  const Icon = ROLE_ICONS[role];
  return <Icon className="h-3.5 w-3.5" />;
}
