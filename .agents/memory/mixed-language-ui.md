---
name: Mixed-language UI prevention
description: Static JSX labels can bypass i18next and cause one page to display multiple languages
---

## Rule
Every user-visible label, including illustrative dashboard mockups and admin controls, must come from the active i18next locale rather than a literal string in JSX.

**Why:** A language switch only rerenders text passed through the translation function; hardcoded labels remain in their original language and make the page appear partially translated.

**How to apply:** When adding or reviewing a page, search for visible string literals in JSX and move them into all locale files. Recheck dynamic toasts, empty/loading states, and decorative product previews as well as headings and navigation.