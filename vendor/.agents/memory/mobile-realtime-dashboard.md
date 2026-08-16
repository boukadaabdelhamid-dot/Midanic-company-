---
name: Mobile real-time dashboard
description: The data contract and presentation rule for the Mobile Temps réel screen.
---

Mobile Temps réel is an order dashboard: it loads store-scoped admin orders through the generated orders hook, derives today's orders/revenue and status counts, shows the latest orders, and refreshes every 10 seconds. The existing WebSocket remains responsible for cache invalidation and notifications; it is not a historical data source.

**Why:** ERP's Temps réel screen visibly contains order KPIs and recent order activity. A WebSocket-only explanation card cannot show existing data because WebSocket messages are transient and there is no API event-history endpoint.

**How to apply:** Keep the screen on the generated `/api/admin/orders` contract, preserve the current store and permission boundary, and use WebSocket invalidation plus periodic refetch for freshness. Do not invent a realtime-history endpoint.