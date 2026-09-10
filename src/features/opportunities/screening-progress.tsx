"use client";

import { cn } from "@/lib/cn";
import {
  refineProgressForElapsed,
  screeningProgressForElapsed,
  type ScreeningProgressView,
} from "@/lib/opportunities/screening-progress";
import { useEffect, useState } from "react";

export function ScreeningProgressOverlay({
  variant = "discovery",
}: {
  variant?: "discovery" | "refine";
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  const view =
    variant === "refine" ? refineProgressForElapsed(elapsedMs) : screeningProgressForElapsed(elapsedMs);

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-canvas/80 p-4 pt-8 backdrop-blur-[2px] sm:p-6 sm:pt-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={view.heading}
    >
      <ScreeningProgressPanel view={view} />
    </div>
  );
}

export function ScreeningProgressPanel({ view }: { view: ScreeningProgressView }) {
  return (
    <section className="w-full max-w-lg rounded-md border border-line bg-surface p-5 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Geographic screening</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{view.heading}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{view.waitCopy}</p>
      <ol className="mt-5 space-y-3">
        {view.stages.map((stage) => (
          <li key={stage.id} className="flex gap-3">
            <StageMark status={stage.status} />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  stage.status === "pending" && "text-muted",
                  stage.status === "active" && "text-ink",
                  stage.status === "complete" && "text-ink",
                )}
              >
                {stage.title}
              </p>
              {stage.status === "active" ? (
                <p className="mt-0.5 text-xs leading-5 text-muted">{stage.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {view.navigateCopy ? <p className="mt-5 text-xs leading-5 text-muted">{view.navigateCopy}</p> : null}
    </section>
  );
}

function StageMark({ status }: { status: "complete" | "active" | "pending" }) {
  if (status === "complete") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[11px] text-ink"
        aria-label="Complete"
      >
        ✓
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink bg-ink"
        aria-label="In progress"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-muted"
      aria-label="Pending"
    >
      ○
    </span>
  );
}
