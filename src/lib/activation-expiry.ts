export type ActivationDurationUnit =
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

export const ACTIVATION_DURATION_UNITS: {
  value: ActivationDurationUnit;
  label: string;
}[] = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export type ActivationExpiryInput = {
  amount: number;
  unit: ActivationDurationUnit;
};

/** Compute absolute expiry from now (or `from`). Returns null if amount is invalid. */
export function computeActivationExpiresAt(
  input: ActivationExpiryInput,
  from: Date = new Date(),
): Date | null {
  const amount = Math.floor(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1) return null;

  const d = new Date(from.getTime());
  switch (input.unit) {
    case "hours":
      d.setHours(d.getHours() + amount);
      break;
    case "days":
      d.setDate(d.getDate() + amount);
      break;
    case "weeks":
      d.setDate(d.getDate() + amount * 7);
      break;
    case "months":
      d.setMonth(d.getMonth() + amount);
      break;
    case "years":
      d.setFullYear(d.getFullYear() + amount);
      break;
    default:
      return null;
  }
  return d;
}

export function isActivationExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

export function formatActivationExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
