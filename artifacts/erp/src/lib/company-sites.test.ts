import assert from "node:assert/strict";
import test from "node:test";
import { getCompanySiteCount } from "./company-sites";

const site = (id: number, kind: "store" | "factory", isActive = true) => ({ id, kind, isActive });

test("unknown company locations are not treated as a confirmed single site", () => {
  assert.equal(getCompanySiteCount(undefined), null);
});

test("one store or one factory is a single-site company", () => {
  assert.equal(getCompanySiteCount([site(1, "store")]), 1);
  assert.equal(getCompanySiteCount([site(1, "factory")]), 1);
});

test("one factory plus one store retains multiple-site navigation", () => {
  assert.equal(getCompanySiteCount([site(1, "factory"), site(2, "store")]), 2);
});

test("multiple ordinary stores retain multiple-site navigation", () => {
  assert.equal(getCompanySiteCount([site(1, "store"), site(2, "store"), site(3, "store")]), 3);
});

test("inactive locations and duplicated IDs do not increase the count", () => {
  assert.equal(getCompanySiteCount([site(1, "store"), site(2, "factory", false), site(1, "store")]), 1);
  assert.equal(getCompanySiteCount([]), 0);
});

test("company-wide locations, not employee memberships, determine the count", () => {
  const company = [site(1, "store"), site(2, "store")];
  const employeeMemberships = [company[0]];
  assert.equal(getCompanySiteCount(employeeMemberships), 1);
  assert.equal(getCompanySiteCount(company), 2);
});
