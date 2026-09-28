import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToErpDate,
  addErpContractPeriod,
  canAccessErpTenant,
  daysBetweenErpDates,
  getEffectiveErpTenantStatus,
  isValidErpDate,
} from "./erp-contracts";

test("monthly and yearly contract periods clamp to the last calendar day", () => {
  assert.equal(addErpContractPeriod("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(addErpContractPeriod("2024-01-31", "monthly"), "2024-02-29");
  assert.equal(addErpContractPeriod("2024-02-29", "yearly"), "2025-02-28");
});

test("contract dates are validated and calendar-day helpers preserve date-only values", () => {
  assert.equal(isValidErpDate("2026-09-28"), true);
  assert.equal(isValidErpDate("2026-02-29"), false);
  assert.equal(isValidErpDate("2026-9-28"), false);
  assert.equal(addDaysToErpDate("2026-09-28", 7), "2026-10-05");
  assert.equal(daysBetweenErpDates("2026-09-28", "2026-10-05"), 7);
});

test("contract access includes the start date and stops on the expiry date", () => {
  const activeContract = {
    status: "converted",
    contractPeriod: "monthly" as const,
    contractStartsAt: "2026-09-28",
    contractEndsAt: "2026-10-28",
  };

  assert.equal(
    canAccessErpTenant(activeContract, new Date("2026-09-28T12:00:00.000Z")),
    true,
  );
  assert.equal(
    canAccessErpTenant(activeContract, new Date("2026-10-28T12:00:00.000Z")),
    false,
  );
  assert.equal(
    getEffectiveErpTenantStatus(
      activeContract,
      new Date("2026-10-28T12:00:00.000Z"),
    ),
    "expired",
  );
});

test("future contract starts and expired trials deny access", () => {
  assert.equal(
    canAccessErpTenant({
      status: "converted",
      contractPeriod: "yearly",
      contractStartsAt: "2026-09-29",
      contractEndsAt: "2027-09-29",
    }, new Date("2026-09-28T12:00:00.000Z")),
    false,
  );

  const expiredTrial = {
    status: "active",
    trialEndsAt: new Date("2026-09-28T11:00:00.000Z"),
  };
  assert.equal(
    canAccessErpTenant(expiredTrial, new Date("2026-09-28T12:00:00.000Z")),
    false,
  );
  assert.equal(
    getEffectiveErpTenantStatus(expiredTrial, new Date("2026-09-28T12:00:00.000Z")),
    "expired",
  );
});