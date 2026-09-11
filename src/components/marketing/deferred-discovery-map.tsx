"use client";

import { DiscoveryMap } from "@/components/marketing/discovery-map";
import { useEffect, useRef, useState } from "react";

export function DeferredDiscoveryMap({
  size = "full",
  eager = false,
  variant = "discovery",
}: {
  size?: "hero" | "full";
  eager?: boolean;
  variant?: "discovery" | "workspace";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [intersected, setIntersected] = useState(false);
  const ready = eager || intersected;

  useEffect(() => {
    if (eager) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true);
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
      ? "h-[280px] bg-[#e4ebe8] sm:h-[400px] lg:h-[460px]"
      : "h-[220px] bg-[#e4ebe8] sm:h-[280px] lg:h-[320px]";

  return (
    <div ref={ref}>
      {ready ? (
        <DiscoveryMap size={size} variant={variant} />
      ) : (
        <div className={placeholderClass} aria-hidden />
      )}
    </div>
  );
}
