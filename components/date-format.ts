const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative time for lists and meta lines, e.g. "5 min ago", "Yesterday", "Mar 4". */
export function relativeTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`;
  if (elapsed < 2 * DAY) return "Yesterday";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Full timestamp for tooltips, e.g. "Mar 4, 2026, 3:12 PM". */
export function fullDate(value: string) {
  return new Date(value).toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Relative time phrased for the middle of a sentence, e.g. "Edited yesterday". */
export function editedLabel(value: string) {
  const relative = relativeTime(value);
  const lowercase = relative === "Just now" || relative === "Yesterday";
  return `Edited ${lowercase ? relative.toLowerCase() : relative}`;
}
