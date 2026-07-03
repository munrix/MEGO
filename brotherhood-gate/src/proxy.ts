import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/check",
  "/api/public",
  "/manifest.json",
  "/sw.js",
  "/hunt", // player app (register/play/screen) — admin lives at /hunt/admin
  "/s", // station scan URLs
  "/api/hunt", // player endpoints — admin endpoints live at /api/hunt/admin
];

// staff-only sub-paths of otherwise public prefixes
const PROTECTED_PATHS = ["/hunt/admin", "/api/hunt/admin"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (
    !isProtected &&
    (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
      pathname.startsWith("/theme/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/icons/") ||
      pathname === "/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("bg_session")?.value;
  if (token) {
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(process.env.SESSION_SECRET!)
      );
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
