import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", req.url));
  }
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const state = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", process.env.SESSION_SECRET || "dev-secret-change-me")
    .update(state).digest("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(url);
  res.cookies.set("sy_oauth_state", `${state}.${sig}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/",
  });
  return res;
}
