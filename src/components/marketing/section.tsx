import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function MarketingSection({
  id,
  children,
  className,
  dark = false,
  wide = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  wide?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:px-10 lg:py-28",
        dark ? "bg-ink text-white" : "bg-canvas text-ink",
        className,
      )}
    >
      <div className={cn("mx-auto", wide ? "max-w-[1200px]" : "max-w-[1120px]")}>
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
      {children}
    </p>
  );
}
