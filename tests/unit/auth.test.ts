import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/auth/login/route";
import { verifySessionToken } from "../../lib/auth";

const originalPasscode = process.env.TEAM_PASSCODE;

afterEach(() => {
  if (originalPasscode === undefined) {
    delete process.env.TEAM_PASSCODE;
  } else {
    process.env.TEAM_PASSCODE = originalPasscode;
  }
});

describe("persistent passcode session", () => {
  it("issues a non-expiring token in a persistent HTTP-only cookie after valid login", async () => {
    process.env.TEAM_PASSCODE = "test-team-passcode";
    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode: "test-team-passcode" }),
    });

    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") ?? "";
    const token = cookie.match(/church_team_session=([^;]+)/)?.[1];

    expect(response.status).toBe(200);
    expect(cookie).toContain("Max-Age=315360000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(token).toBeTruthy();
    expect(await verifySessionToken(decodeURIComponent(token!))).toBe(true);

    const payload = JSON.parse(
      Buffer.from(decodeURIComponent(token!).split(".")[1], "base64url").toString("utf8")
    );
    expect(payload.exp).toBeUndefined();
  });
});
