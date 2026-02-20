import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--accent)] text-white",
        secondary: "border-transparent bg-[var(--bg-muted)] text-[var(--text-strong)]",
        destructive: "border-transparent bg-[var(--danger)] text-white",
        outline: "border-[var(--border-soft)] text-[var(--text-body)]",
        success: "border-transparent bg-[#dcfce7] text-[var(--ok)]",
        warning: "border-transparent bg-[#fef3c7] text-[var(--warn)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
