import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

export function CtaLink({
  href,
  children,
  variant = "primary",
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "on-dark";
  className?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
    variant === "primary" && "bg-teal text-white hover:bg-teal-dark",
    variant === "secondary" && "border border-line bg-surface text-ink hover:bg-canvas",
    variant === "ghost" && "text-muted hover:text-ink",
    variant === "on-dark" && "border border-white/20 bg-white/5 text-white hover:bg-white/10",
    className,
  );

  if (href.startsWith("http")) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} onClick={onClick}>
      {children}
    </Link>
  );
}
