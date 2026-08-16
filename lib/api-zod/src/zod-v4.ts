// Re-export zod v4 API so generated Orval schemas (which use zod.int(), zod.email(), etc.)
// resolve correctly. Orval 8.23+ generates v4 syntax; zod@3.x ships v4 under 'zod/v4'.
export * from "zod/v4";
