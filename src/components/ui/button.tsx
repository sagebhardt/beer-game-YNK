import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white shadow-sm hover:-translate-y-px hover:bg-[var(--accent-hover)]",
        cta:
          "bg-[var(--cta)] text-white shadow-sm hover:-translate-y-px hover:bg-[var(--cta-hover)]",
        destructive:
          "bg-[var(--danger)] text-white hover:bg-[#951f37]",
        outline:
          "border border-[var(--border-soft)] bg-white text-[var(--text-strong)] hover:bg-[var(--bg-muted)]",
        ghost: "text-[var(--text-body)] hover:bg-[var(--bg-muted)]",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
