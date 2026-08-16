import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  LoginBody,
  RefreshTokenBody,
  LogoutBody,
} from "@workspace/api-zod";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  validateRefreshToken,
  formatUserProfile,
} from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again later" },
});

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName, companyName, language } = parsed.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      companyName: companyName ?? null,
      language: language ?? "en",
      role: "customer",
    })
    .returning();
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);
  res.status(201).json({ accessToken, refreshToken, user: formatUserProfile(user) });
});

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (!user.isActive) {
    res.status(401).json({ error: "Account is deactivated" });
    return;
  }
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);
  // `token` is kept as an ERP-compatible alias while the platform continues
  // using accessToken/refreshToken.
  res.json({
    accessToken,
    token: accessToken,
    refreshToken,
    user: {
      ...formatUserProfile(user),
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
      preferredLang: user.language,
    },
  });
});

// ERP uses the same Midanic access token, but its client expects this
// resource-oriented identity endpoint.
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    role: user.role === "super_admin" ? "admin" : user.role,
    preferredLang: user.language,
    phone: user.phone ?? null,
    address: null,
    city: null,
    stores: [],
    currentStoreId: null,
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { refreshToken } = parsed.data;
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  const isValid = await validateRefreshToken(refreshToken);
  if (!isValid) {
    res.status(401).json({ error: "Refresh token expired or revoked" });
    return;
  }
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, payload.userId),
  });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found or inactive" });
    return;
  }
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  res.json({ accessToken });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const parsed = LogoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.sendStatus(204);
    return;
  }
  await revokeRefreshToken(parsed.data.refreshToken);
  res.sendStatus(204);
});

export default router;
