import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { outlookTone } from "@/lib/format";
import type {
  ChecklistStatus,
  Confidence,
  ConnectionCaseStatus,
  DataSourceKind,
  DocumentStatus,
  Outlook,
  PipelineStage,
} from "@/types";

const base =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide";

export function OutlookBadge({ outlook }: { outlook: Outlook }) {
  const tone = outlookTone(outlook);
  return (
    <span
      className={cn(
        base,
        tone === "success" && "bg-success-bg text-success",
        tone === "warning" && "bg-warning-bg text-warning",
        tone === "critical" && "bg-critical-bg text-critical",
        tone === "neutral" && "bg-canvas text-muted",
      )}
    >
      {outlook}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={cn(
        base,
        confidence === "High" && "bg-teal-soft text-teal",
        confidence === "Medium" && "bg-warning-bg text-warning",
        confidence === "Low" && "bg-canvas text-muted",
      )}
    >
      {confidence}
    </span>
  );
}

export function StageBadge({ stage }: { stage: PipelineStage | string }) {
  return <span className={cn(base, "bg-canvas text-ink")}>{stage}</span>;
}

export function SourceBadge({ source }: { source: DataSourceKind }) {
  return (
    <span
      className={cn(
        base,
        source === "Official" && "bg-success-bg text-success",
        source === "Indicative" && "bg-info-bg text-info",
        source === "Customer Data" && "bg-canvas text-ink",
        source === "NOXHEIM Analysis" && "bg-teal-soft text-teal",
      )}
    >
      {source}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: ConnectionCaseStatus | DocumentStatus | ChecklistStatus;
}) {
  const critical = status === "Overdue" || status === "Missing" || status === "At Risk";
  const warning =
    status === "In Progress" ||
    status === "Incomplete" ||
    status === "Waiting" ||
    status === "Draft";
  const success = status === "Complete" || status === "On Track";

  return (
    <span
      className={cn(
        base,
        success && "bg-success-bg text-success",
        warning && "bg-warning-bg text-warning",
        critical && "bg-critical-bg text-critical",
        !success && !warning && !critical && "bg-canvas text-muted",
      )}
    >
      {status}
    </span>
  );
}

export function CountBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "critical" | "neutral" | "teal";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        tone === "critical" && "bg-critical text-white",
        tone === "teal" && "bg-teal text-white",
        tone === "neutral" && "bg-canvas text-muted",
      )}
    >
      {children}
    </span>
  );
}
