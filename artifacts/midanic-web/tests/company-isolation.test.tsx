import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminErp from "../src/pages/admin/erp";
import { Toaster } from "../src/components/ui/toaster";
import { companyFixtures } from "./company-fixtures";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// Use the real production page, dialogs, state, API client and toaster.
// Only fix the locale and replace the network; never mount the mockup.
vi.mock("@/lib/admin-i18n", () => ({
  useAdminText: () => ({ tAdmin: (text: string) => text, language: "en" }),
}));

let records: ReturnType<typeof companyFixtures>;
let writes: { url: string; method: string; body: Record<string, unknown> }[];
let failNext: "json" | "html" | "network" | null;
let releaseWrite: (() => void) | null;
let holdWrite: boolean;
let location: ReturnType<typeof memoryLocation>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  records = companyFixtures();
  writes = [];
  failNext = null;
  releaseWrite = null;
  holdWrite = false;
  location = memoryLocation({ path: "/admin/erp", record: true });
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url === "/api/admin/erp/tenants") return json({ tenants: records });
    if (method === "GET" && url.startsWith("/api/admin/customers?")) return json({ customers: [] });
    const match = /^\/api\/admin\/erp\/tenants\/(\d+)(\/(?:domain|web-store-domain))?$/.exec(url);
    if (!match || !["PATCH", "DELETE"].includes(method)) {
      throw new Error(`Unexpected test request: ${method} ${url}`);
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    writes.push({ url, method, body });
    if (holdWrite) await new Promise<void>((resolve) => { releaseWrite = resolve; });
    if (failNext) {
      const failure = failNext;
      failNext = null;
      if (failure === "network") throw new Error("Fixture network unavailable");
      if (failure === "html") return new Response("<html>Fixture gateway unavailable</html>", {
        status: 502, headers: { "content-type": "text/html" },
      });
      return json({ error: "Fixture API rejected this company update" }, 409);
    }
    const id = Number(match[1]);
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return json({ error: "Unknown fixture company" }, 404);
    records[index] = { ...records[index], ...body };
    if (method === "DELETE") {
      records[index] = match[2] === "/domain"
        ? { ...records[index], subdomain: null, hostname: null, domainStatus: "inactive" }
        : { ...records[index], webStoreSubdomain: null, webStoreHostname: null, webStoreDomainStatus: "inactive" };
    }
    return json(records[index]);
  }));
});

async function start() {
  const user = userEvent.setup();
  render(<Router hook={location.hook}><AdminErp /><Toaster /></Router>);
  await screen.findByText("Fixture Alpha");
  return user;
}

function row(name: string) {
  return within(screen.getByRole("row", { name: new RegExp(name) }));
}

const editors = [
  { name: "features", open: /Manage features/, title: "Manage company features",
    label: "Maximum number of stores", save: "Save features", original: "3", other: "7", draft: "9",
    payload: { maxStores: 9 }, success: "Company features updated", failure: "Feature update failed" },
  { name: "ERP domain", open: /company-101.example.test|company-202.example.test|company-303.example.test/,
    title: "Manage ERP company domain", label: "Subdomain", save: "Save domain",
    original: "company-101", other: "company-202", draft: "edited-alpha",
    payload: { subdomain: "edited-alpha", domainStatus: "inactive" },
    success: "ERP domain updated", failure: "Domain update failed" },
  { name: "Web Store", open: /shop-\d+.example.test/, title: "Manage customer Web Store",
    label: "Web Store subdomain", save: "Save Web Store",
    original: "shop-101", other: "shop-202", draft: "edited-shop",
    payload: { webStoreSubdomain: "edited-shop" },
    success: "Web Store settings updated", failure: "Web Store update failed" },
  { name: "contract", open: /Set contract|Manage contract/, title: "Manage ERP contract",
    label: "Contract start date", save: "Save contract", original: null, other: "2026-03-01",
    draft: "2026-06-01", payload: { contractStartsAt: "2026-06-01", status: "converted" },
    success: "Contract settings saved", failure: "Update failed" },
] as const;

async function openEditor(user: ReturnType<typeof userEvent.setup>, company: string, editor: typeof editors[number]) {
  if (screen.queryByRole("button", { name: "Back to register" })) {
    await user.click(screen.getByRole("button", { name: "Back to register" }));
  }
  await user.click(row(company).getByRole("button", { name: `Open company: ${company}` }));
  await user.click(screen.getByRole("tab", {
    name: editor.name === "features" ? "Features" : editor.name === "contract" ? "Contract & import" : "Access & security",
  }));
  await user.click(screen.getByRole("button", {
    name: editor.name === "ERP domain" ? "Company domain"
      : editor.name === "Web Store" ? "Configure Web Store" : editor.open,
  }));
  const dialog = screen.getByRole("dialog", { name: editor.title });
  expect(dialog).toHaveTextContent(company);
  return within(dialog);
}

function edit(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("production ERP company identity (two companies share an owner)", () => {
  it("searches by company, owner and ID; filters never substitute the company being saved", async () => {
    const user = await start();
    let search = screen.getByRole("textbox", { name: "Search companies" });
    await user.type(search, "owner-9001@example.test");
    expect(row("Fixture Alpha")).toBeDefined();
    expect(row("Fixture Beta")).toBeDefined();
    expect(screen.queryByRole("row", { name: /Fixture Gamma/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "All groups" }));
    await user.click(screen.getByRole("option", { name: /Contracted accounts/ }));
    expect(screen.queryByRole("row", { name: /Fixture Alpha/ })).not.toBeInTheDocument();
    await openEditor(user, "Fixture Beta", editors[0]);
    edit(editors[0].label, "12");
    await user.click(screen.getByRole("button", { name: "Save features" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ url: "/api/admin/erp/tenants/202", body: { maxStores: 12 } });
    expect(records[0].maxStores).toBe(3);
    expect(records[2].maxStores).toBe(3);
    await screen.findByText("Company features updated");
    await user.click(screen.getByRole("button", { name: "Back to register" }));
    await user.click(screen.getByRole("combobox", { name: "All groups" }));
    await user.click(screen.getByRole("option", { name: /All ERP accounts/ }));
    search = screen.getByRole("textbox", { name: "Search companies" });
    await user.clear(search);
    await user.type(search, "303");
    await openEditor(user, "Fixture Gamma", editors[0]);
    edit(editors[0].label, "15");
    await user.click(screen.getByRole("button", { name: "Save features" }));
    await screen.findByText("Company features updated");
    expect(writes[1].url).toBe("/api/admin/erp/tenants/303");
    expect(records[1].maxStores).toBe(12);
  });

  it("combines status, account-group and search filters without changing row identity", async () => {
    const user = await start();
    await user.click(screen.getByRole("combobox", { name: "All statuses" }));
    await user.click(screen.getByRole("option", { name: "suspended" }));
    expect(row("Fixture Gamma")).toBeDefined();
    expect(screen.queryByRole("row", { name: /Fixture Alpha|Fixture Beta/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search companies" }), "Alpha");
    expect(screen.getByText("No matching companies")).toBeInTheDocument();
    await user.click(screen.getByTestId("company-metric-trial"));
    expect(row("Fixture Alpha")).toBeDefined(); // group navigation resets status, not company IDs
    expect(writes).toEqual([]);
  });

  for (const editor of editors) {
    it(`${editor.name}: cancel and switching owners discard drafts; reopening restores the latest saved value`, async () => {
      const user = await start();
      await openEditor(user, "Fixture Alpha", editor);
      const original = (screen.getByLabelText(editor.label) as HTMLInputElement).value;
      if (editor.original !== null) expect(original).toBe(editor.original);
      edit(editor.label, editor.draft);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await openEditor(user, "Fixture Beta", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(editor.other);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await openEditor(user, "Fixture Gamma", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).not.toBe(editor.draft);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await openEditor(user, "Fixture Alpha", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(original);
      expect(writes).toEqual([]);
      edit(editor.label, editor.draft);
      await user.click(screen.getByRole("button", { name: editor.save }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({ url: "/api/admin/erp/tenants/101", method: "PATCH", body: editor.payload });
      expect(records.slice(1)).toEqual(companyFixtures().slice(1));
      await openEditor(user, "Fixture Alpha", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(editor.draft);
      edit(editor.label, editor.original === "3" ? "18" : "2026-08-01");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await openEditor(user, "Fixture Alpha", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(editor.draft);
    });

    it(`${editor.name}: failed API save preserves the draft, reports failure and never claims success`, async () => {
      const user = await start();
      await openEditor(user, "Fixture Alpha", editor);
      edit(editor.label, editor.draft);
      failNext = "json";
      await user.click(screen.getByRole("button", { name: editor.save }));
      await screen.findByText("Fixture API rejected this company update");
      expect(screen.getByText(editor.failure)).toBeInTheDocument();
      expect(screen.queryByText(editor.success)).not.toBeInTheDocument();
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(editor.draft);
      expect(records).toEqual(companyFixtures());
      await user.click(screen.getByRole("button", { name: editor.save }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes.map((write) => write.url)).toEqual([
        "/api/admin/erp/tenants/101", "/api/admin/erp/tenants/101",
      ]);
      expect(records.slice(1)).toEqual(companyFixtures().slice(1));
    });

    it(`${editor.name}: an in-flight save cannot be dismissed and later close another company's editor`, async () => {
      const user = await start();
      await openEditor(user, "Fixture Alpha", editor);
      edit(editor.label, editor.draft);
      holdWrite = true;
      await user.click(screen.getByRole("button", { name: editor.save }));
      await waitFor(() => expect(releaseWrite).not.toBeNull());
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: editor.title })).toHaveTextContent("Fixture Alpha");
      expect(writes).toHaveLength(1);
      await act(async () => releaseWrite!());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await openEditor(user, "Fixture Beta", editor);
      expect((screen.getByLabelText(editor.label) as HTMLInputElement).value).toBe(editor.other);
    });
  }

  for (const editor of [editors[1], editors[2]]) {
    it(`${editor.name}: destructive confirmation identifies the company and hostname; cancellation and failure cannot delete another company`, async () => {
      const user = await start();
      const suffix = editor.name === "ERP domain" ? "domain" : "web-store-domain";
      const hostname = editor.name === "ERP domain" ? "company-202.example.test" : "shop-202.example.test";
      await openEditor(user, "Fixture Beta", editor);
      await user.click(screen.getByRole("button", { name: "Delete domain" }));
      let confirmation = within(screen.getByRole("alertdialog"));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(`Fixture Beta · #202 · ${hostname}`);
      await user.click(confirmation.getByRole("button", { name: "Cancel" }));
      expect(writes).toEqual([]);
      await user.click(screen.getByRole("button", { name: "Delete domain" }));
      confirmation = within(screen.getByRole("alertdialog"));
      failNext = "json";
      await user.click(confirmation.getByRole("button", { name: "Delete domain" }));
      await screen.findByText("Fixture API rejected this company update");
      expect(screen.getByRole("alertdialog")).toHaveTextContent("Fixture Beta");
      expect(screen.queryByText(/^(ERP|Web Store) domain deleted$/)).not.toBeInTheDocument();
      expect(records).toEqual(companyFixtures());
      await user.click(confirmation.getByRole("button", { name: "Delete domain" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(writes).toEqual([
        { url: `/api/admin/erp/tenants/202/${suffix}`, method: "DELETE", body: {} },
        { url: `/api/admin/erp/tenants/202/${suffix}`, method: "DELETE", body: {} },
      ]);
      expect(records[0]).toEqual(companyFixtures()[0]);
      expect(records[2]).toEqual(companyFixtures()[2]);
    });
  }

  for (const failure of ["html", "network"] as const) {
    it(`reports ${failure} failure without a success toast or losing the draft`, async () => {
      const user = await start();
      await openEditor(user, "Fixture Alpha", editors[0]);
      edit(editors[0].label, "22");
      failNext = failure;
      await user.click(screen.getByRole("button", { name: "Save features" }));
      await screen.findByText("Feature update failed");
      expect(screen.getByText(failure === "network"
        ? "Fixture network unavailable"
        : /API returned text\/html.*HTTP 502/)).toBeInTheDocument();
      expect(screen.queryByText("Company features updated")).not.toBeInTheDocument();
      expect(screen.getByLabelText(editors[0].label)).toHaveValue(22);
      expect(records).toEqual(companyFixtures());
    });
  }

  it("catalog drafts stay local across tabs and companies, and discard restores the last saved setting", async () => {
    const user = await start();
    await user.click(screen.getByRole("button", { name: "Open company: Fixture Alpha" }));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await user.selectOptions(screen.getByLabelText("Product catalog"), "shared");
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("separate");
    await user.selectOptions(screen.getByLabelText("Product catalog"), "shared");
    await user.click(screen.getByRole("tab", { name: "General" }));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("shared");
    await user.click(screen.getByRole("button", { name: "Back to register" }));
    await user.click(screen.getByRole("button", { name: "Open company: Fixture Beta" }));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("shared");
    await user.selectOptions(screen.getByLabelText("Product catalog"), "separate");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const confirm = within(screen.getByRole("alertdialog"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Fixture Beta · #202");
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent("Fixture Alpha");
    await user.click(confirm.getByRole("button", { name: "Cancel" }));
    expect(writes).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Product catalog setting saved");
    expect(writes).toEqual([{
      url: "/api/admin/erp/tenants/202", method: "PATCH", body: { productCatalogMode: "separate" },
    }]);
    expect(records[0]).toEqual(companyFixtures()[0]);
    expect(records[2]).toEqual(companyFixtures()[2]);
    await user.selectOptions(screen.getByLabelText("Product catalog"), "shared");
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("separate");
    await user.click(screen.getByRole("button", { name: "Back to register" }));
    await user.click(screen.getByRole("button", { name: "Open company: Fixture Alpha" }));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("separate");
  });

  it("catalog API failure keeps the named confirmation and allows retry without claiming success", async () => {
    const user = await start();
    await user.click(screen.getByRole("button", { name: "Open company: Fixture Alpha" }));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await user.selectOptions(screen.getByLabelText("Product catalog"), "shared");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    failNext = "json";
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Could not save product catalog setting");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Fixture Alpha · #101");
    expect(screen.queryByText("Product catalog setting saved")).not.toBeInTheDocument();
    expect(records).toEqual(companyFixtures());
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Product catalog setting saved");
    expect(writes.map(write => write.url)).toEqual([
      "/api/admin/erp/tenants/101", "/api/admin/erp/tenants/101",
    ]);
  });

  it("access confirmation targets the selected company; failed suspension remains retryable", async () => {
    const user = await start();
    await user.click(screen.getByRole("button", { name: "Open company: Fixture Beta" }));
    await user.click(screen.getByRole("tab", { name: "Access & security" }));
    await user.selectOptions(screen.getByLabelText("Status"), "suspended");
    let confirm = within(screen.getByRole("alertdialog"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Fixture Beta · #202");
    await user.click(confirm.getByRole("button", { name: "Cancel" }));
    expect(writes).toEqual([]);
    expect(screen.getByLabelText("Status")).toHaveValue("converted");
    await user.selectOptions(screen.getByLabelText("Status"), "suspended");
    confirm = within(screen.getByRole("alertdialog"));
    failNext = "json";
    await user.click(confirm.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Update failed");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Fixture Beta · #202");
    expect(screen.queryByText("ERP account updated")).not.toBeInTheDocument();
    expect(records).toEqual(companyFixtures());
    await user.click(confirm.getByRole("button", { name: "Confirm" }));
    await screen.findByText("ERP account updated");
    expect(screen.getByLabelText("Status")).toHaveValue("suspended");
    expect(writes).toEqual([
      { url: "/api/admin/erp/tenants/202", method: "PATCH", body: { status: "suspended" } },
      { url: "/api/admin/erp/tenants/202", method: "PATCH", body: { status: "suspended" } },
    ]);
    expect(records[0]).toEqual(companyFixtures()[0]);
    expect(records[2]).toEqual(companyFixtures()[2]);
  });

  it("direct detail navigation remounts drafts and confirmations even for the same owner", async () => {
    const user = await start();
    await act(async () => location.navigate("/admin/erp?company=101"));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    await user.selectOptions(screen.getByLabelText("Product catalog"), "shared");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await act(async () => location.navigate("/admin/erp?company=202"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("company-detail-202")).toHaveTextContent("Fixture Beta");
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    await act(async () => location.navigate("/admin/erp?company=101"));
    await user.click(screen.getByRole("tab", { name: "Features" }));
    expect(screen.getByLabelText("Product catalog")).toHaveValue("separate");
    expect(writes).toEqual([]);
  });

  it("feature switches are drafts, not shared objects between companies or saved records", async () => {
    const user = await start();
    await openEditor(user, "Fixture Alpha", editors[0]);
    expect(screen.getByRole("switch", { name: "Reports feature" })).toBeChecked();
    await user.click(screen.getByRole("switch", { name: "Reports feature" }));
    expect(records[0].featureFlags.reports).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await openEditor(user, "Fixture Beta", editors[0]);
    expect(screen.getByRole("switch", { name: "Reports feature" })).not.toBeChecked();
    await user.click(screen.getByRole("switch", { name: "Reports feature" }));
    await user.click(screen.getByRole("button", { name: "Save features" }));
    await screen.findByText("Company features updated");
    expect(writes[0]).toMatchObject({
      url: "/api/admin/erp/tenants/202", body: { featureFlags: { reports: true }, maxStores: 7 },
    });
    expect(records[0]).toEqual(companyFixtures()[0]);
    expect(records[2]).toEqual(companyFixtures()[2]);
    await openEditor(user, "Fixture Alpha", editors[0]);
    expect(screen.getByRole("switch", { name: "Reports feature" })).toBeChecked();
  });

  it("loads list failures as an explicit retryable error, not a successful empty company register", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(async () => json({ error: "Fixture list unavailable" }, 503));
    const user = userEvent.setup();
    render(<Router hook={location.hook}><AdminErp /><Toaster /></Router>);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fixture list unavailable");
    expect(screen.queryByText("No matching companies")).not.toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Refresh" }));
    await screen.findByText("Fixture Alpha");
    expect(screen.getByTestId("company-row-202")).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
});
