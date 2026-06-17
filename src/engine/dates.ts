// Local-time date helpers (no external deps).

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function todayYmd(): string {
  return ymd(new Date());
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function dayOfWeek(s: string): number {
  return parseYmd(s).getDay();
}

/** Sunday on or before the given date (week start). */
export function weekStartOf(s: string): string {
  const d = parseYmd(s);
  return addDays(s, -d.getDay());
}

export function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDate(s: string): string {
  const d = parseYmd(s);
  return `${DAY_NAMES[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Read an energy value tolerant of both the old (string) and new ({level,updatedAt}) shapes. */
export function energyLevel(e: unknown): string {
  if (!e) return "full";
  return typeof e === "string" ? e : ((e as { level?: string }).level ?? "full");
}

export function daysUntil(deadline: string): number {
  const end = parseYmd(deadline).getTime();
  const now = parseYmd(todayYmd()).getTime();
  return Math.max(0, Math.round((end - now) / 86400000));
}
