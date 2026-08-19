import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-teal text-white hover:bg-teal-dark",
        variant === "secondary" &&
          "border border-line bg-surface text-ink hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
        variant === "danger" && "text-critical hover:bg-critical-bg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
