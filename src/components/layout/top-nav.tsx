"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beer, Plus, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Beer },
  { href: "/crear", label: "Crear", icon: Plus },
  { href: "/unirse", label: "Unirse", icon: Users },
  { href: "/admin", label: "Admin", icon: Shield },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-white/88 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
          <Beer className="h-4 w-4 text-[var(--accent)]" />
          Beer Game YNK
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent-light)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-body)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
