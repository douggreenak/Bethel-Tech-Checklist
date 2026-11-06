import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "./db";
import { loginAttempts } from "./schema";
import { and, gt, sql } from "drizzle-orm";

import { COOKIE_NAME } from "./constants";
export { COOKIE_NAME };

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "church-tech-checklist-fallback-secret-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

export function verifyPasscode(inputPasscode: string): boolean {
  const expected = process.env.TEAM_PASSCODE || "";
  if (!expected) return false;

  const a = Buffer.from(inputPasscode);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({ team: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return Boolean(payload.team);
  } catch {
    return false;
  }
}

export async function isAuthenticatedRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function isAuthenticatedSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(sql`${loginAttempts.ip} = ${ip}`, gt(loginAttempts.attemptedAt, tenMinutesAgo)));

    const count = Number(recent[0]?.count || 0);
    return count < 10;
  } catch {
    // If DB is temporarily unavailable or in local mock, don't hard-block
    return true;
  }
}

export async function recordLoginAttempt(ip: string): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      id: crypto.randomUUID(),
      ip,
      attemptedAt: new Date(),
    });

    // Prune attempts older than 1 hour asynchronously
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await db.delete(loginAttempts).where(sql`${loginAttempts.attemptedAt} < ${oneHourAgo}`);
  } catch (e) {
    console.error("Failed to record login attempt:", e);
  }
}
