import type { DeadlineAttention } from "@/lib/domain/connection-deadlines";
import { deadlineAttention } from "@/lib/domain/connection-deadlines";
import type { DeadlineKind } from "@/lib/alerts/natural-key";

export function requirementDeadlineKind(input: {
  required: boolean;
  status: string;
  dueDate: string | null;
  now?: Date;
}): DeadlineKind | null {
  if (!input.required || input.status === "complete") {
    return null;
  }
  const attention = deadlineAttention(input.dueDate, input.now);
  if (attention === "overdue" || attention === "approaching") {
    return attention;
  }
  return null;
}

export function connectionDeadlineKind(input: {
  status: string;
  deadline: string | null;
  now?: Date;
}): DeadlineKind | null {
  if (input.status === "complete" || input.status === "cancelled") {
    return null;
  }
  const attention = deadlineAttention(input.deadline, input.now);
  if (attention === "overdue" || attention === "approaching") {
    return attention;
  }
  return null;
}

export function shouldResolveDeadlineAlert(input: {
  kind: DeadlineKind;
  current: DeadlineKind | null;
}): boolean {
  return input.current !== input.kind;
}

export function workflowDeadlineSeverity(): "warning" {
  return "warning";
}

export function toDeadlineKind(attention: DeadlineAttention | null): DeadlineKind | null {
  if (attention === "approaching" || attention === "overdue") {
    return attention;
  }
  return null;
}
