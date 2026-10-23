# Company isolation regression checks

Run from the workspace root:

```sh
pnpm --filter @workspace/midanic-web test:company-isolation
```

These interaction tests mount the **production** `AdminErp` page, including the
Company register/detail components, Wouter navigation, Radix dialogs, API client
and toaster. They do not import the visual mockup.

The three records are recreated for each test: Alpha and Beta share an owner;
Gamma has a different owner. The network is entirely replaced with a strict,
in-memory fixture service. Unexpected requests fail, and no real account,
password, database, email, or external service is used.

Coverage includes search/group/status filters, direct detail navigation, draft
isolation, cancel/discard, reopening the latest saved settings, exact mutation
URLs/payloads, unchanged sibling records, named catalog/access/domain
confirmations, JSON/HTML/network failures and retries, list loading failure,
and delayed saves that must not dismiss or affect a later editor.

These are DOM integration checks, not a claim that real backend authorization or
database tenant isolation has been tested.
