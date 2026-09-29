import { Router, type IRouter } from "express";
import { count, desc, ilike, or } from "drizzle-orm";
import {
  CreateDesktopLicenseBody,
  CreateDesktopLicenseResponse,
  ListDesktopLicensesQueryParams,
  ListDesktopLicensesResponse,
} from "@workspace/api-zod";
import { db, desktopLicensesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { isDatabaseUniqueViolation } from "../lib/db-errors";
import { generateLegacyDesktopLicenseKey } from "../lib/legacy-desktop-license";

const router: IRouter = Router();
const DESKTOP_LICENSE_PAGE_SIZE_DEFAULT = 20;
const DESKTOP_LICENSE_PAGE_SIZE_MAX = 100;

// Only platform super admins may issue or inspect desktop keys.
router.use("/admin", requireAuth, requireRole("super_admin"));

router.get("/admin/desktop-licenses", async (req, res): Promise<void> => {
  const parsedQuery = ListDesktopLicensesQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const page = parsedQuery.data.page ?? 1;
  const limit = Math.min(
    parsedQuery.data.limit ?? DESKTOP_LICENSE_PAGE_SIZE_DEFAULT,
    DESKTOP_LICENSE_PAGE_SIZE_MAX,
  );
  const search = parsedQuery.data.search?.trim() ?? "";
  const filter = search
    ? or(
        ilike(desktopLicensesTable.customerName, `%${search}%`),
        ilike(desktopLicensesTable.hwid, `%${search}%`),
        ilike(desktopLicensesTable.licenseKey, `%${search}%`),
      )
    : undefined;

  const [licenses, [totalRow]] = await Promise.all([
    db
      .select()
      .from(desktopLicensesTable)
      .where(filter)
      .orderBy(desc(desktopLicensesTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: count() })
      .from(desktopLicensesTable)
      .where(filter),
  ]);

  res.json(ListDesktopLicensesResponse.parse({
    licenses,
    total: Number(totalRow?.total ?? 0),
    page,
    limit,
  }));
});

router.post("/admin/desktop-licenses", async (req, res): Promise<void> => {
  const parsed = CreateDesktopLicenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The HWID must contain exactly 16 letters or digits." });
    return;
  }

  const hwid = parsed.data.hwid.toUpperCase();
  const customerName = parsed.data.customerName?.trim() || null;

  let licenseKey: string;
  try {
    licenseKey = generateLegacyDesktopLicenseKey(hwid);
  } catch (error) {
    req.log.error({ err: error }, "Legacy desktop license key generation is unavailable");
    res.status(503).json({ error: "Desktop license key generation is not configured" });
    return;
  }

  try {
    const [license] = await db
      .insert(desktopLicensesTable)
      .values({ customerName, hwid, licenseKey })
      .returning();
    res.status(201).json(CreateDesktopLicenseResponse.parse(license));
  } catch (error) {
    if (isDatabaseUniqueViolation(error)) {
      res.status(409).json({ error: "A desktop key already exists for this HWID" });
      return;
    }
    throw error;
  }
});

export default router;