---
name: Mobile drawer accordion
description: Approved interaction model for the Mobile ERP sidebar navigation.
---

The Mobile ERP sidebar uses the existing menu groups as an accordion. Only group headings are collapsible; individual menu items remain direct links. One group is open at a time, and the group containing the current route opens automatically.

**Why:** The sidebar contains many modules and becomes difficult to scan on a phone when every group is expanded.

**How to apply:** Keep the account/store header, permission filtering, labels, routes, and footer unchanged when refining the sidebar. Use a visible chevron and accessible expanded state on each group heading.