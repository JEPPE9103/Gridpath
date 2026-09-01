"use client";

import { MarketingMap, type MarketingMapSite } from "@/components/marketing/marketing-map";
import { useEffect, useRef, useState } from "react";

export function DeferredMarketingMap({
  sites,
  selectedId,
  size = "full",
  eager = false,
}: {
  sites: MarketingMapSite[];
  selectedId: string;
  size?: "hero" | "default" | "full";
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (eager) {
      setReady(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  const placeholderClass =
    size === "full"
      ? "h-[280px] bg-[#e4ebe8] sm:h-[400px] lg:h-[520px]"
      : size === "hero"
        ? "h-[196px] bg-[#e4ebe8] sm:h-[236px] lg:h-[268px]"
        : "h-[240px] bg-[#e4ebe8] sm:h-[300px] lg:h-[340px]";

  return (
    <div ref={ref}>
      {ready ? (
        <MarketingMap selectedId={selectedId} sites={sites} size={size} />
      ) : (
        <div className={placeholderClass} aria-hidden />
      )}
    </div>
  );
}
