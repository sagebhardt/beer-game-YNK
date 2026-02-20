import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ title, subtitle, rightSlot, children, className }: PageShellProps) {
  return (
    <section className={cn("app-shell", className)}>
      <header className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-white/80 p-4 shadow-[0_18px_35px_-28px_rgba(20,35,80,0.6)] md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}
