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
    "inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
    variant === "primary" &&
      "bg-ink !text-white hover:bg-[#242a33] motion-safe:hover:-translate-y-px motion-safe:hover:shadow-[0_10px_22px_-14px_rgba(26,30,36,0.55)]",
    variant === "secondary" &&
      "border border-line bg-surface text-ink hover:bg-canvas motion-safe:hover:-translate-y-px",
    variant === "ghost" && "text-muted hover:text-ink",
    variant === "on-dark" && "border border-white/20 bg-white/5 !text-white hover:bg-white/10",
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
