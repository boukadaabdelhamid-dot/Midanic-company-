import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

// Execute the actual route with read-only database doubles, without a live tenant
// or authentication setup. Unexpected queries/writes fail rather than touching data.
const source = readFileSync(new URL("../routes/erp.ts", import.meta.url), "utf8");
const start = source.indexOf('router.get("/erp/suppliers/:id/operations"');
assert.notEqual(start, -1);
const end = source.indexOf('\nrouter.post(', start);
const code = transformSync(source.slice(start, end), { loader: "ts", target: "es2022" }).code;

const operation = (id: number, type: string, amount: string, date: string) => ({
  id, type, amount, date, createdAt: `${date}T12:00:00Z`,
  balanceBefore: null, balanceAfter: null, reference: null, note: null, poId: null,
});
const supplierOperations = [
  operation(1, "purchase", "100.00", "2026-10-01"),
  operation(2, "purchase_comptant", "750.00", "2026-10-02"),
  operation(3, "payment", "20.00", "2026-10-03"),
  operation(4, "ajustement", "5.00", "2026-10-04"),
  operation(5, "ajustement", "-3.00", "2026-10-05"),
  operation(6, "purchase_comptant", "999.00", "2026-10-06"),
];
const customerOperations = [
  operation(10, "vente_a_terme", "40.00", "2026-10-01"),
  operation(11, "versement", "10.00", "2026-10-03"),
  operation(12, "avoir_retour", "2.00", "2026-10-04"),
  operation(13, "remboursement", "4.00", "2026-10-05"),
];

async function statement(unified: boolean, query: Record<string, string> = {}, cashOnly = false) {
  const supplier = { id: 7, storeId: 1, contactId: unified ? 8 : null, currentBalance: "-78.00" };
  const rows = (cashOnly ? [supplierOperations[1]] : supplierOperations)
    .map((op) => ({ op, storeNameAr: "متجر", storeNameEn: "Store" }));
  const results: unknown[] = [[supplier], rows];
  if (unified) results.push(
    [{ contactType: "customer_supplier", currentBalance: "-46.00" }],
    [{ userId: 9 }],
    customerOperations.map((op) => ({ op, storeNameAr: "متجر", storeNameEn: "Store" })),
  );
  const original = JSON.stringify(results);
  const consumed: unknown[] = [];
  let handler: (req: unknown, res: unknown) => Promise<void>;
  const noop = () => undefined;
  const context = {
    router: { get: (...args: unknown[]) => { handler = args.at(-1) as typeof handler; } },
    authenticate: noop, requireStaff: noop, requireStore: noop, requirePermission: () => noop,
    pid: () => 7, eq: noop, and: noop, asc: noop, inArray: noop,
    schema: new Proxy({}, { get: () => ({}) }),
    db: {
      select() {
        assert.ok(results.length, "unexpected extra database query");
        const result = results.shift();
        consumed.push(result);
        const chain = {
          from: () => chain, where: () => chain, leftJoin: () => chain,
          orderBy: () => chain, limit: () => chain,
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
        return chain;
      },
    },
  };
  vm.runInNewContext(code, context);
  let response: any;
  await handler!({
    query, currentStoreId: 1,
    log: { error: (error: unknown) => { throw error; } },
  }, {
    json: (value: unknown) => { response = value; },
    status: (status: number) => { throw new Error(`Unexpected HTTP ${status}`); },
  });
  assert.equal(results.length, 0);
  assert.equal(JSON.stringify(consumed), original, "no historical data or canonical balances may change");
  return response;
}

for (const unified of [false, true]) {
  test(`cash purchases preserve running balances (unified=${unified})`, async () => {
    const response = await statement(unified);
    const ops = response.operations.filter((op: any) => op.source === "supplier");
    assert.deepEqual(Array.from(ops, (op: any) => op.runningBalance), unified
      ? ["-100.00", "-60.00", "-40.00", "-45.00", "-50.00", "-46.00"]
      : ["100.00", "100.00", "80.00", "75.00", "78.00", "78.00"]);
    assert.equal(response.supplier.currentBalance, "-78.00");
    assert.equal(response.contactBalance, unified ? "-46.00" : null);
    for (const op of ops) {
      assert.equal(op.balanceBefore, null, "legacy snapshots must not be invented");
      assert.equal(op.balanceAfter, null);
    }
  });

  test(`date filtering retains full-history balances (unified=${unified})`, async () => {
    const full = await statement(unified);
    const filtered = await statement(unified, { startDate: "2026-10-03", endDate: "2026-10-05" });
    assert.equal(JSON.stringify(filtered.operations), JSON.stringify(full.operations.filter(
      (op: any) => op.date >= "2026-10-03" && op.date <= "2026-10-05",
    )));
    assert.equal(filtered.contactBalance, full.contactBalance);
    assert.equal(filtered.supplier.currentBalance, full.supplier.currentBalance);
    const cashDay = await statement(unified, { startDate: "2026-10-06", endDate: "2026-10-06" });
    assert.equal(cashDay.operations.length, 1);
    assert.equal(cashDay.operations[0].runningBalance, unified ? "-46.00" : "78.00");
    const empty = await statement(unified, { startDate: "2027-01-01" });
    assert.equal(empty.operations.length, 0);
    assert.equal(empty.contactBalance, full.contactBalance);
    assert.equal(empty.supplier.currentBalance, full.supplier.currentBalance);
  });
}

test("a supplier history containing only cash purchases has zero running balance", async () => {
  const response = await statement(false, {}, true);
  assert.equal(response.operations[0].runningBalance, "0.00");
});
