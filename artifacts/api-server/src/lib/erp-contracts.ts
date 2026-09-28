export type ErpContractPeriod = "monthly" | "yearly";
export type ErpTenantAccessStatus =
  | "pending"
  | "active"
  | "suspended"
  | "expired"
  | "converted"
  | "none"
  | "unknown";

export interface ErpContractAccessState {
  status: string;
  trialEndsAt?: Date | null;
  contractPeriod?: ErpContractPeriod | null;
  contractStartsAt?: string | null;
  contractEndsAt?: string | null;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidErpDate(value: unknown): value is string {
  return typeof value === "string" && dateParts(value) !== null;
}

export function getErpBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToErpDate(value: string, days: number): string {
  const parts = dateParts(value);
  if (!parts || !Number.isInteger(days)) {
    throw new RangeError("A valid date and integer day offset are required");
  }
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateString(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

export function addErpContractPeriod(
  startsAt: string,
  period: ErpContractPeriod,
): string {
  const parts = dateParts(startsAt);
  if (!parts) throw new RangeError("A valid contract start date is required");

  const monthsToAdd = period === "monthly" ? 1 : 12;
  const targetMonthIndex = parts.year * 12 + parts.month - 1 + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return dateString(targetYear, targetMonth, Math.min(parts.day, lastDayOfTargetMonth));
}

export function getEffectiveErpTenantStatus(
  state: ErpContractAccessState,
  now = new Date(),
): ErpTenantAccessStatus {
  const today = getErpBusinessDate(now);
  if (
    state.contractPeriod &&
    state.contractEndsAt &&
    state.contractEndsAt <= today
  ) {
    return "expired";
  }
  if (
    state.status === "active" &&
    state.trialEndsAt &&
    state.trialEndsAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return state.status as ErpTenantAccessStatus;
}

export function canAccessErpTenant(
  state: ErpContractAccessState,
  now = new Date(),
): boolean {
  const effectiveStatus = getEffectiveErpTenantStatus(state, now);
  if (effectiveStatus !== "active" && effectiveStatus !== "converted") return false;

  if (state.contractPeriod) {
    const today = getErpBusinessDate(now);
    if (
      !state.contractStartsAt ||
      !state.contractEndsAt ||
      state.contractStartsAt > today ||
      state.contractEndsAt <= today
    ) {
      return false;
    }
  }
  return true;
}

export function daysBetweenErpDates(from: string, to: string): number {
  const fromParts = dateParts(from);
  const toParts = dateParts(to);
  if (!fromParts || !toParts) throw new RangeError("Valid dates are required");
  return Math.round(
    (
      Date.UTC(toParts.year, toParts.month - 1, toParts.day) -
      Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)
    ) / 86_400_000,
  );
}