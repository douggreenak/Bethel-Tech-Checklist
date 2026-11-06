import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  getClientIp,
  recordLoginAttempt,
  verifyPasscode,
  createSessionToken,
  COOKIE_NAME,
} from "@/lib/auth";

const SESSION_COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;

const LoginSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait 10 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { passcode } = parsed.data;
    const isValid = verifyPasscode(passcode);
    if (!isValid) {
      await recordLoginAttempt(ip);
      return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
