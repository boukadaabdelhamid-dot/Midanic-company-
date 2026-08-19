import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, usersTable, refreshTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not set. " +
    "Generate a strong random secret and add it to your environment."
  );
}
const ACCESS_TOKEN_SECRET = SESSION_SECRET;
const REFRESH_TOKEN_SECRET = SESSION_SECRET + ":refresh";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export function generateErpSsoToken(payload: {
  userId: number;
  email: string;
  role: string;
  tenantId: number;
  hostname: string;
}): string {
  return jwt.sign(
    { ...payload, aud: "erp", purpose: "sso" },
    process.env.PLATFORM_SSO_SECRET ?? ACCESS_TOKEN_SECRET,
    { expiresIn: "2m" },
  );
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  await db.insert(refreshTokensTable).values({ userId, token, expiresAt });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.token, token));
}

export async function validateRefreshToken(token: string): Promise<boolean> {
  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.token, token));
  if (!stored) return false;
  if (stored.expiresAt < new Date()) {
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.token, token));
    return false;
  }
  return true;
}

export async function getUserById(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user || null;
}

export function formatUserProfile(user: typeof usersTable.$inferSelect) {
  const { passwordHash, twoFactorSecret, ...rest } = user;
  return rest;
}

logger.info("Auth library initialized");
