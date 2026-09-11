export interface PasswordResetTokenRecord {
  expiresAt: Date;
  used: boolean;
}

export function isPasswordResetTokenUsable(
  record: PasswordResetTokenRecord | undefined,
  now = Date.now(),
): boolean {
  return Boolean(record && !record.used && record.expiresAt.getTime() > now);
}