// Helpers shared by DashboardPage views. No external deps.

export function toLocalDateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildDayWindow(daysAgoFrom, daysAgoTo) {
  // Inclusive range [daysAgoFrom..daysAgoTo], ordered oldest -> newest.
  const days = [];
  const now = new Date();
  for (let offset = daysAgoFrom; offset >= daysAgoTo; offset -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    days.push({
      key: toLocalDateKey(d),
      date: d,
      weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      label: d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      isToday: offset === 0,
    });
  }
  return days;
}

export function buildLastSevenDays() {
  return buildDayWindow(6, 0);
}

export function buildPriorSevenDays() {
  // The 7 days BEFORE the current week (days 7..13 ago).
  return buildDayWindow(13, 7);
}

export function countByDay(items, keyGetter, days) {
  const counts = Object.fromEntries(days.map((d) => [d.key, 0]));
  for (const item of items) {
    const key = toLocalDateKey(keyGetter(item));
    if (key && key in counts) counts[key] += 1;
  }
  return counts;
}

export function sumValues(obj) {
  return Object.values(obj).reduce((sum, n) => sum + n, 0);
}

export function countItemsInDays(items, keyGetter, days) {
  // Faster than countByDay when only the total matters.
  const keys = new Set(days.map((d) => d.key));
  let n = 0;
  for (const item of items) {
    if (keys.has(toLocalDateKey(keyGetter(item)))) n += 1;
  }
  return n;
}

// Returns { value: number, sign: -1|0|1, direction: "up"|"down"|"flat" }.
// When previous is 0, treats current as +Infinity-like and returns 100 * current
// as a coarse signal (or 0 when current is also 0).
export function percentDelta(current, previous) {
  if (previous === 0 && current === 0) {
    return { value: 0, sign: 0, direction: "flat" };
  }
  if (previous === 0) {
    return { value: 100, sign: 1, direction: "up" };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw);
  const sign = Math.sign(rounded);
  return {
    value: Math.abs(rounded),
    sign,
    direction: sign > 0 ? "up" : sign < 0 ? "down" : "flat",
  };
}

// CSS var lookup. Falls back to a sane hex so charts render server-side too.
export const STATUS_PALETTE = {
  Available: "var(--cyan, #30b0c7)",
  "Need Setup": "var(--amber, #ff9f0a)",
  "Need Checking": "var(--amber, #ff9f0a)",
  "Pending Profile": "var(--purple, #bf5af2)",
  Active: "var(--green, #34c759)",
  Ready: "var(--blue, #0071e3)",
  Delivered: "var(--purple, #5e5ce6)",
  Flagged: "var(--orange, #ff6b35)",
  Banned: "var(--red, #ff375f)",
};

export function statusColor(status) {
  return STATUS_PALETTE[status] || "var(--text2)";
}

// Negative metrics = more is bad. Used to invert the green/red coloring on
// week-over-week deltas (e.g. more Flagged this week than last week is bad).
export const NEGATIVE_METRICS = new Set([
  "flaggedBanned",
  "deadProxies",
  "missingProxies",
  "missing2FA",
]);

export function deltaColorClass(delta, metricKey) {
  if (delta.sign === 0) return "dashboard-delta-flat";
  const isNegativeMetric = NEGATIVE_METRICS.has(metricKey);
  const isGoodChange = isNegativeMetric ? delta.sign < 0 : delta.sign > 0;
  return isGoodChange ? "dashboard-delta-good" : "dashboard-delta-bad";
}
