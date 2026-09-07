export type DeadlineAttention = "overdue" | "approaching" | "normal";

function parseDateOnly(value: string): Date | null {
  const datePart = value.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole days from today to the deadline. Negative means overdue. */
export function deadlineDayDelta(
  deadline: string | null | undefined,
  now = new Date(),
): number | null {
  if (!deadline) {
    return null;
  }
  const due = parseDateOnly(deadline);
  if (!due) {
    return null;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function deadlineRelativeLabel(
  deadline: string | null | undefined,
  now = new Date(),
): string | null {
  const days = deadlineDayDelta(deadline, now);
  if (days == null) {
    return null;
  }
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`;
  }
  if (days === 0) {
    return "Due today";
  }
  return days === 1 ? "Due in 1 day" : `Due in ${days} days`;
}

/**
 * Display-only deadline attention. Does not change stored case status.
 * overdue: deadline before today; approaching: due within 14 days.
 */
export function deadlineAttention(
  deadline: string | null | undefined,
  now = new Date(),
): DeadlineAttention | null {
  const days = deadlineDayDelta(deadline, now);
  if (days == null) {
    return null;
  }
  if (days < 0) {
    return "overdue";
  }
  if (days <= 14) {
    return "approaching";
  }
  return "normal";
}
