import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { encodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("sy_oauth_state")?.value;
  if (!code || !state || !stateCookie) return fail("google");

  const [cookieState, cookieSig] = stateCookie.split(".");
  const expected = createHmac("sha256", process.env.SESSION_SECRET || "dev-secret-change-me")
    .update(cookieState).digest("hex");
  if (cookieState !== state || cookieSig !== expected) return fail("google");

  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google");
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return fail("google");

  // id_token was fetched server-side directly from Google over TLS, so decoding
  // the payload without local signature verification is safe here.
  let email: string | undefined, verified: boolean | undefined;
  try {
    const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
    email = String(payload.email ?? "").toLowerCase();
    verified = Boolean(payload.email_verified);
  } catch {
    return fail("google");
  }
  if (!email || !verified) return fail("google");

  // Staff-only CRM: the Google account must match an existing user's email.
  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) return fail("unauthorized");

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("sy_session", encodeSession({
    userId: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`,
    role: user.role.name, exp: Date.now() + 7 * 24 * 3600 * 1000,
  }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.delete("sy_oauth_state");
  return res;
}
