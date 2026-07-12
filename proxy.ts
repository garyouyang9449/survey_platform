import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  RESPONDENT_COOKIE,
  RESPONDENT_COOKIE_MAX_AGE,
} from "./lib/respondent-shared";

/**
 * Proxy (formerly Middleware in Next < 16). Ensures every visitor carries an
 * anonymous `respondent_id` cookie so their survey/interview state can be
 * resumed on return. We only ISSUE the id here; the Respondent row is created
 * lazily on the first API call (proxy must stay fast and avoid DB access).
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  if (!request.cookies.has(RESPONDENT_COOKIE)) {
    response.cookies.set(RESPONDENT_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RESPONDENT_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  // Run on page routes only; skip static assets and API routes (those resolve
  // identity via getOrCreateRespondentId, which can also set the cookie).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
