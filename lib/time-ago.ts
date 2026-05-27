/** Compact "time ago" string, e.g. "3h", "2d", "just now". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";

  const units: [limit: number, secs: number, suffix: string][] = [
    [60, 1, "s"],
    [3600, 60, "m"],
    [86400, 3600, "h"],
    [2592000, 86400, "d"],
    [31536000, 2592000, "mo"],
    [Infinity, 31536000, "y"],
  ];
  for (const [limit, secs, suffix] of units) {
    if (seconds < limit) return `${Math.floor(seconds / secs)}${suffix} ago`;
  }
  return "";
}
