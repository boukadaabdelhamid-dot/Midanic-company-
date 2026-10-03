import { sql, type SQL } from "drizzle-orm";

/** Algerian local/international formats have one identity; other international
 * numbers retain their country code. Never identify a customer by name alone. */
export function normalizeCustomerPhone(value: string): string | null {
  const ascii = value.replace(/[٠-٩۰-۹]/g, c =>
    String(c.charCodeAt(0) >= 0x6f0 ? c.charCodeAt(0) - 0x6f0 : c.charCodeAt(0) - 0x660));
  if (!/^[+\d\s().-]+$/.test(ascii)) return null;
  let digits = ascii.replace(/\D/g, "").replace(/^00/, "");
  if (/^0[567]\d{8}$/.test(digits)) digits = `213${digits.slice(1)}`;
  else if (/^[567]\d{8}$/.test(digits)) digits = `213${digits}`;
  else if (/^2130[567]\d{8}$/.test(digits)) digits = `213${digits.slice(4)}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function normalizedPhoneSql(column: SQL): SQL {
  const digits = sql`regexp_replace(regexp_replace(translate(coalesce(${column}, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g'), '^00', '')`;
  return sql`CASE
    WHEN ${digits} ~ '^0[567][0-9]{8}$' THEN '213' || substring(${digits} from 2)
    WHEN ${digits} ~ '^[567][0-9]{8}$' THEN '213' || ${digits}
    WHEN ${digits} ~ '^2130[567][0-9]{8}$' THEN '213' || substring(${digits} from 5)
    ELSE ${digits} END`;
}