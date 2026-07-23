import { NextRequest, NextResponse } from "next/server";

// Lightweight route guard: presence check only (HMAC verified server-side in pages).
export function middleware(req: NextRequest) {
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  const hasSession = Boolean(req.cookies.get("sy_session")?.value);
  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
