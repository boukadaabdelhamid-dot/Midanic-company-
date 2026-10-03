import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, schema } from "./db";
import { signToken } from "./auth";
import { runWebOrdersMigration } from "./web-orders-migration";

/** Development-only fixtures: no existing store, account, or product is edited. */
export async function seedWebOrderFixture() {
  if (process.env.NODE_ENV === "production") throw new Error("Test fixtures are forbidden in production");
  await runWebOrdersMigration(pool);
  const suffix = randomUUID();
  const stores = await db.insert(schema.storesTable).values([
    { nameAr: "متجر اختبار الطلب المباشر", nameEn: "Guest checkout test store", slug: `guest-test-${suffix}`, isActive: true },
    { nameAr: "متجر اختبار معزول", nameEn: "Other isolated test store", slug: `guest-other-${suffix}`, isActive: true },
  ]).returning();
  const password = randomUUID();
  const users = await db.insert(schema.usersTable).values([
    { name: "Test staff", email: `staff-${suffix}@example.test`, passwordHash: await hash(password, 10), role: "admin", preferredLang: "ar" },
    { name: "Test buyer", email: `buyer-${suffix}@example.test`, passwordHash: await hash(password, 10), role: "customer", preferredLang: "ar" },
  ]).returning();
  await db.insert(schema.userStoresTable).values(stores.map(store => ({ storeId: store.id, userId: users[0].id })));
  const [category] = await db.insert(schema.categoriesTable).values({
    storeId: stores[0].id, nameAr: "فئة اختبار", nameEn: "Test category",
  }).returning();
  const [product] = await db.insert(schema.productsTable).values({
    storeId: stores[0].id, categoryId: category.id, nameAr: "منتج اختبار الطلب المباشر",
    nameEn: "Guest checkout test product", descriptionAr: "منتج مخصص للاختبار فقط",
    descriptionEn: "A development-only checkout fixture", price: "2500.00", stock: 30, isExposed: true,
  }).returning();
  const staffToken = signToken({ id: users[0].id, email: users[0].email, role: "admin", currentStoreId: stores[0].id });
  const otherStaffToken = signToken({ id: users[0].id, email: users[0].email, role: "admin", currentStoreId: stores[1].id });
  const buyerToken = signToken({ id: users[1].id, email: users[1].email, role: "customer" });
  return { store: stores[0], otherStore: stores[1], staff: users[0].id, buyer: users[1].id,
    product: product.id, category: category.id, staffToken, otherStaffToken, buyerToken };
}
export type WebOrderFixture = Awaited<ReturnType<typeof seedWebOrderFixture>>;

export async function cleanWebOrderFixture(f: WebOrderFixture) {
  const stores = [f.store.id, f.otherStore.id];
  const profiles = await db.select().from(schema.customerProfilesTable).where(inArray(schema.customerProfilesTable.storeId, stores));
  const orders = await db.select().from(schema.ordersTable).where(inArray(schema.ordersTable.storeId, stores));
  await db.delete(schema.webCustomersTable).where(inArray(schema.webCustomersTable.storeId, stores));
  await db.delete(schema.webOrderAccessTable).where(inArray(schema.webOrderAccessTable.storeId, stores));
  if (orders.length) await db.delete(schema.orderItemsTable).where(inArray(schema.orderItemsTable.orderId, orders.map(o => o.id)));
  await db.delete(schema.inventoryMovementsTable).where(inArray(schema.inventoryMovementsTable.storeId, stores));
  await db.delete(schema.ordersTable).where(inArray(schema.ordersTable.storeId, stores));
  await db.delete(schema.cartItemsTable).where(inArray(schema.cartItemsTable.storeId, stores));
  await db.delete(schema.customerProfilesTable).where(inArray(schema.customerProfilesTable.storeId, stores));
  await db.delete(schema.contactsTable).where(inArray(schema.contactsTable.storeId, stores));
  await db.delete(schema.userStoresTable).where(inArray(schema.userStoresTable.storeId, stores));
  await db.delete(schema.productsTable).where(eq(schema.productsTable.id, f.product));
  await db.delete(schema.categoriesTable).where(eq(schema.categoriesTable.id, f.category));
  await db.delete(schema.storeWebSettingsTable).where(inArray(schema.storeWebSettingsTable.storeId, stores));
  await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, stores));
  const userIds = [...new Set([f.staff, f.buyer, ...profiles.map(p => p.userId)])];
  await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
}