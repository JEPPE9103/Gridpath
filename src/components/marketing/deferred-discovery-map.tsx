"use client";

import {
  DiscoveryMap,
  type DiscoveryWorkflowStage,
} from "@/components/marketing/discovery-map";
import { useEffect, useRef, useState } from "react";

export function DeferredDiscoveryMap({
  size = "full",
  eager = false,
  variant = "discovery",
  selectedSiteId,
  showLegend,
  workflowStage,
  className,
}: {
  size?: "hero" | "full" | "thumb";
  eager?: boolean;
  variant?: "discovery" | "workspace";
  selectedSiteId?: string;
  showLegend?: boolean;
  workflowStage?: DiscoveryWorkflowStage;
  className?: string;
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
      : size === "thumb"
        ? "h-[148px] w-full bg-[#e4ebe8]"
        : "h-[320px] bg-[#e4ebe8] sm:h-[340px] lg:h-[400px]";

  return (
    <div ref={ref} className={className}>
      {ready ? (
        <DiscoveryMap
          size={size}
          variant={variant}
          selectedSiteId={selectedSiteId}
          showLegend={showLegend}
          workflowStage={workflowStage}
        />
      ) : (
        <div className={placeholderClass} aria-hidden />
      )}
    </div>
  );
}
