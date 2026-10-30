import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "./lib/constants";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/cron/week",
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.ico",
  "/robots.txt",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static Next.js internals and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // Cron route authenticates with Bearer token, middleware lets it pass to the route handler
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  let isValid = false;

  if (token) {
    try {
      const secret = new TextEncoder().encode(
        process.env.SESSION_SECRET || "church-tech-checklist-fallback-secret-at-least-32-chars-long"
      );
      const { payload } = await jwtVerify(token, secret);
      if (payload.team) {
        isValid = true;
      }
    } catch {
      isValid = false;
    }
  }

  if (!isValid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
  ],
};
