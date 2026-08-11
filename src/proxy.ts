import { NextResponse, type NextRequest } from "next/server";
import { LANGUAGE_COOKIE, selectRequestLanguage } from "@/lib/locale-routing";

export function proxy(request: NextRequest) {
  const locale = selectRequestLanguage(
    request.cookies.get(LANGUAGE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );

  return NextResponse.redirect(new URL(`/${locale}`, request.url), 307);
}

export const config = {
  matcher: ["/"],
};
