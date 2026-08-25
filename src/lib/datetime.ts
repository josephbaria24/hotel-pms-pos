const PH_TIME_ZONE = "Asia/Manila";

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const raw = value.trim();
  // SQLite DATETIME commonly comes as "YYYY-MM-DD HH:mm:ss" (UTC without zone marker).
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(" ", "T") + "Z");
  }
  // If timestamp has date+time but no explicit zone, treat as UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw)) {
    return new Date(raw + "Z");
  }
  return new Date(raw);
}

export function formatPhDateTime(value: DateInput): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatPhDate(value: DateInput): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatPhTime(value: DateInput): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Hotel-local calendar date (`YYYY-MM-DD`) in Asia/Manila. */
export function todayYmdPh(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Hotel stays are [check-in, check-out): checkout day is free for the next guest. */
export function staysOverlap(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return Boolean(aIn && aOut && bIn && bOut && aIn < bOut && bIn < aOut);
}
