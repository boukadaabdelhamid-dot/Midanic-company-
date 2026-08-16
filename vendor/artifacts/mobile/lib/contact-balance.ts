export function getContactBalance(contact: unknown): number {
  if (!contact || typeof contact !== "object") return 0;

  const value = contact as Record<string, unknown>;
  const profile =
    value.profile && typeof value.profile === "object"
      ? (value.profile as Record<string, unknown>)
      : undefined;

  const rawBalance =
    value.currentBalance ??
    value.current_balance ??
    profile?.currentBalance ??
    profile?.current_balance ??
    0;
  const balance = Number(rawBalance);

  return Number.isFinite(balance) ? balance : 0;
}