export type DeadlineAttention = "overdue" | "approaching" | "normal";

function parseDateOnly(value: string): Date | null {
  const datePart = value.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Display-only deadline attention. Does not change stored case status.
 * overdue: deadline before today; approaching: due within 14 days.
 */
export function deadlineAttention(
  deadline: string | null | undefined,
  now = new Date(),
): DeadlineAttention | null {
  if (!deadline) {
    return null;
  }
  const due = parseDateOnly(deadline);
  if (!due) {
    return null;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    return "overdue";
  }
  if (days <= 14) {
    return "approaching";
  }
  return "normal";
}
