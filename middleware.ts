import { NextResponse, type NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE, verifyAuthSession } from "@/lib/auth-session";

const ADMIN_ROUTES = ["/admin", "/history"];

function isAdminRoute(pathname: string) {
  return ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicRoute(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/api/auth/");
}

function localRedirectUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const activeUser = await verifyAuthSession(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  const isLoginPage = pathname === "/login";

  if (!activeUser && !isPublicRoute(pathname)) {
    const loginUrl = localRedirectUrl(request, "/login");
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(loginUrl);
  }

  if (activeUser && isLoginPage) {
    return NextResponse.redirect(localRedirectUrl(request, "/"));
  }

  if (activeUser && isAdminRoute(pathname) && activeUser.role !== "ADMIN") {
    return NextResponse.redirect(localRedirectUrl(request, "/"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|seed|cognee).*)"],
  runtime: "experimental-edge",
};
