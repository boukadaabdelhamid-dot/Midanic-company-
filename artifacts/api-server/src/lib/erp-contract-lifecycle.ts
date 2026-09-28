import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  addDaysToErpDate,
  daysBetweenErpDates,
  getErpBusinessDate,
} from "./erp-contracts";
import { sendErpContractReminderEmail } from "./erp-contract-reminder-email";

const CONTRACT_LIFECYCLE_LOCK = 814_730_291;
const REMINDER_WINDOW_DAYS = 7;
const RUN_INTERVAL_MS = 60 * 60 * 1000;

interface ReminderTenant {
  id: number;
  owner_email: string;
  owner_language: string | null;
  company_name: string;
  contract_period: "monthly" | "yearly";
  contract_ends_at: string;
}

export async function runErpContractLifecycleJob(now = new Date()): Promise<void> {
  const today = getErpBusinessDate(now);
  const finalReminderDate = addDaysToErpDate(today, REMINDER_WINDOW_DAYS);
  const client = await pool.connect();
  let hasLock = false;

  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [CONTRACT_LIFECYCLE_LOCK],
    );
    hasLock = lockResult.rows[0]?.acquired === true;
    if (!hasLock) return;

    const expired = await client.query<{ id: number }>(
      `UPDATE erp_tenants
       SET status = 'expired', updated_at = now()
       WHERE status = 'converted'
         AND contract_period IN ('monthly', 'yearly')
         AND contract_ends_at IS NOT NULL
         AND contract_ends_at <= $1::date
       RETURNING id`,
      [today],
    );

    const due = await client.query<ReminderTenant>(
      `SELECT
         tenant.id,
         users.email AS owner_email,
         users.language AS owner_language,
         tenant.company_name,
         tenant.contract_period,
         tenant.contract_ends_at::text AS contract_ends_at
       FROM erp_tenants AS tenant
       INNER JOIN users ON users.id = tenant.owner_user_id
       WHERE tenant.status = 'converted'
         AND tenant.contract_period IN ('monthly', 'yearly')
         AND tenant.contract_starts_at IS NOT NULL
         AND tenant.contract_ends_at > $1::date
         AND tenant.contract_ends_at <= $2::date
         AND (
           tenant.contract_reminder_sent_on IS NULL
           OR tenant.contract_reminder_sent_on < $1::date
         )
       ORDER BY tenant.contract_ends_at, tenant.id`,
      [today, finalReminderDate],
    );

    let sent = 0;
    let failed = 0;
    for (const tenant of due.rows) {
      try {
        await sendErpContractReminderEmail({
          to: tenant.owner_email,
          companyName: tenant.company_name,
          contractEndsAt: tenant.contract_ends_at,
          daysLeft: daysBetweenErpDates(today, tenant.contract_ends_at),
          language: tenant.owner_language,
        });

        const marked = await client.query(
          `UPDATE erp_tenants
           SET contract_reminder_sent_on = $1::date
           WHERE id = $2
             AND status = 'converted'
             AND contract_ends_at = $3::date
             AND (
               contract_reminder_sent_on IS NULL
               OR contract_reminder_sent_on < $1::date
             )
           RETURNING id`,
          [today, tenant.id, tenant.contract_ends_at],
        );
        if ((marked.rowCount ?? 0) > 0) sent += 1;
      } catch (error) {
        failed += 1;
        logger.error(
          { err: error, tenantId: tenant.id },
          "ERP contract reminder email failed",
        );
      }
    }

    if (expired.rowCount || sent || failed) {
      logger.info(
        {
          expiredContracts: expired.rowCount ?? 0,
          remindersSent: sent,
          reminderFailures: failed,
          reminderCandidates: due.rowCount ?? 0,
        },
        "ERP contract lifecycle check completed",
      );
    }
  } finally {
    if (hasLock) {
      await client
        .query("SELECT pg_advisory_unlock($1)", [CONTRACT_LIFECYCLE_LOCK])
        .catch((error: unknown) => {
          logger.error({ err: error }, "Failed to release ERP contract lifecycle lock");
        });
    }
    client.release();
  }
}

export function startErpContractLifecycleScheduler(): void {
  const runSafely = () => {
    void runErpContractLifecycleJob().catch((error: unknown) => {
      logger.error({ err: error }, "ERP contract lifecycle check crashed");
    });
  };

  runSafely();
  const timer = setInterval(runSafely, RUN_INTERVAL_MS);
  timer.unref?.();
}