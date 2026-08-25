import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname === "/es" || url.pathname === "/es/") {
    url.pathname = "/";
    return NextResponse.redirect(url, 301);
  }

  if (url.pathname === "/en/") {
    const destination = new URL("/en", request.url);
    destination.search = url.search;
    return NextResponse.redirect(destination, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/es/:path*", "/en/"],
};
