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