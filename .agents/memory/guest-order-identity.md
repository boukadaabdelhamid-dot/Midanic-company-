---
name: Guest order identity
description: Optional storefront accounts, phone-based CRM matching, and safe ownership of guest orders
---

Guest checkout must remain usable without registering. Use normalized phone numbers to associate ERP customer records; names are searchable labels, never automatic identity or merge keys.

**Why:** The user requested direct ordering with optional registration and staff-managed phone/customer blocking. Different people may share a name.

**How to apply:** Keep the guest basket and order form functional independently of sign-in, and scope matching and blocking to the current tenant/store.

A phone supplied in an unauthenticated form is not verified account ownership. Do not grant access to previous orders or merge login accounts solely because their phone numbers match. Guest order access requires private proof; signed-in history belongs to the account that actually submitted the order.

**Why:** Anyone can type another person's phone number. CRM grouping must not become an account takeover or order-history disclosure.

**How to apply:** If adding account claiming or registration-to-guest-history linking later, require verified phone ownership or the existing private order proof first.