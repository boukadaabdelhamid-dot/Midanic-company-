import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

// Load browser code without pulling DOM-only types into the server's tsconfig.
const fetchModule = { exports: {} as {
  customFetch: (url: string) => Promise<unknown>;
  setBaseUrl: (url: string | null) => void;
  setExtraHeadersGetter: (getter: (() => Record<string, string>) | null) => void;
} };
vm.runInNewContext(transformSync(readFileSync(new URL(
  "../../../../lib/erp-api-client-react/src/custom-fetch.ts", import.meta.url,
), "utf8"), { loader: "ts", format: "cjs" }).code, {
  module: fetchModule, exports: fetchModule.exports,
  Headers, Request, Response, URL, Blob,
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});
const { customFetch, setBaseUrl, setExtraHeadersGetter } = fetchModule.exports;

// Capture useQuery's options while executing the actual hand-written hook.
// The actual customFetch is retained to verify date serialization, store headers
// and error propagation without rendering a component or starting the app.
const source = readFileSync(new URL(
  "../../../../lib/erp-api-client-react/src/expense-reports.ts", import.meta.url,
), "utf8").replace(/^import .*;\r?$/gm, "").replace("export function", "function");
type Options = { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
type Params = { from: string; to: string };
const context = vm.createContext({ URLSearchParams, customFetch, useQuery: (options: Options) => options });
vm.runInContext(transformSync(source, { loader: "ts" }).code, context);
const hook = context.useGetExpenseReportDetails as (params: Params | null, enabled?: boolean) => Options;

test("expense hook sends the exact selected dates and separates period cache keys", () => {
  const january = hook({ from: "2026-01-10", to: "2026-01-31" });
  const february = hook({ from: "2026-02-01", to: "2026-02-05" });
  assert.equal(january.enabled, true);
  assert.deepEqual(Array.from(january.queryKey), ["/api/admin/reports/expenses", "2026-01-10", "2026-01-31"]);
  assert.notDeepEqual(Array.from(january.queryKey), Array.from(february.queryKey));
  assert.notDeepEqual(Array.from(january.queryKey), Array.from(hook({ from: "2026-01-10", to: "2026-01-30" }).queryKey));
});

test("closed dialogs and missing periods disable the request", async () => {
  assert.equal(hook({ from: "2026-01-01", to: "2026-01-31" }, false).enabled, false);
  const empty = hook(null);
  assert.equal(empty.enabled, false);
  assert.deepEqual(Array.from(await empty.queryFn() as unknown[]), []);
});

test("expense requests retain selected dates, current-store headers, numeric amounts and errors", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; headers: Headers }[] = [];
  let store = "store-one";
  let status = 200;
  const item = { id: 1, amount: 120.30, category: "rent", description: "Rent", reference: null, createdAt: "2026-01-10T00:00:00.000Z" };
  setBaseUrl("https://expense-fixture.invalid");
  setExtraHeadersGetter(() => ({ "X-Store-Slug": store }));
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(status === 200 ? [item] : { error: "Unavailable" }), {
      status, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const options = hook({ from: "2026-01-10", to: "2026-01-31" });
    assert.deepEqual(JSON.parse(JSON.stringify(await options.queryFn())), [item]);
    assert.equal(calls[0].url, "https://expense-fixture.invalid/api/admin/reports/expenses?from=2026-01-10&to=2026-01-31");
    assert.equal(calls[0].headers.get("X-Store-Slug"), "store-one");
    store = "store-two";
    await options.queryFn();
    assert.equal(calls[1].headers.get("X-Store-Slug"), "store-two");
    status = 500;
    await assert.rejects(options.queryFn(), "errors must not turn into an empty expense report");
  } finally {
    globalThis.fetch = originalFetch;
    setBaseUrl(null);
    setExtraHeadersGetter(null);
  }
});
