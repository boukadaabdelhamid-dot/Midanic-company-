export function getDatabaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  for (let depth = 0; depth < 5 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }

  return undefined;
}

export function isDatabaseUniqueViolation(error: unknown): boolean {
  return getDatabaseErrorCode(error) === "23505";
}