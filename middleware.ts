import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple cookie-gate for the internal team tool. Protects every route
// except /login and Next internals. Credentials in env (APP_USER/APP_PASS).
export function middleware(req: NextRequest) {
  const authed =
    req.cookies.get("seeding_auth")?.value === process.env.APP_SESSION_SECRET;
  const isLogin = req.nextUrl.pathname === "/login";

  if (!authed && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (authed && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
