---
name: Mixed-language UI prevention
description: Static JSX labels can bypass i18next and cause one page to display multiple languages
---

## Rule
Every user-visible label, including illustrative dashboard mockups and admin controls, must come from the product's active translation mechanism rather than a literal string in JSX.

**Why:** A language switch only rerenders text passed through the translation function; hardcoded labels remain in their original language and make the page appear partially translated.

**How to apply:** When adding or reviewing a page, search for visible string literals in JSX and move them into all locale files. Recheck dynamic toasts, empty/loading states, and decorative product previews as well as headings and navigation.

## Verification after cross-page localization
Run existing presentation regression tests, not only typecheck and build, when changing shared translation helpers. Test fixtures should use real translation functions while stubbing only the language context.

**Why:** The English rollout compiled successfully but left extracted-component tests using incomplete language mocks. Compilation alone did not establish compatibility with existing regression coverage.

**How to apply:** Check language-dependent rendering and unchanged machine values across French, Arabic, and English. Distinguish test-harness failures from actual browser failures before attributing an issue to localization.

## Preview-account verification
Do not consider a development admin ready merely because login succeeds; verify a selected authorized store and a working signed-in Dashboard.

**Why:** The preview admin accepted credentials without any store membership, making multiple pages fail with store-required errors that appeared to be a localization regression.

**How to apply:** Check the actual login/store context before attributing empty or failed pages to translation changes. Keep preview recovery limited to development-only standalone stores; never grant the preview admin access to customer companies.