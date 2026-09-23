const BYTES_PER_GB = 1024n ** 3n;

/**
 * A null limit means unlimited. The additional count defaults to one because
 * the ERP checks this helper immediately before creating one resource.
 */
export function countLimitReached(
  currentCount: number,
  limit: number | null,
  additionalCount = 1,
): boolean {
  return limit !== null && currentCount + additionalCount > limit;
}

/**
 * Storage limits are kept in whole GB by Platform while uploaded file sizes
 * are tracked in bytes by ERP.
 */
export function storageLimitReached(
  usedBytes: bigint,
  requestedBytes: bigint,
  limitGb: number | null,
): boolean {
  return limitGb !== null &&
    usedBytes + requestedBytes > BigInt(limitGb) * BYTES_PER_GB;
}