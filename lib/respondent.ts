import { cookies } from "next/headers";
import { prisma } from "./db";
import {
  RESPONDENT_COOKIE,
  RESPONDENT_COOKIE_MAX_AGE,
} from "./respondent-shared";

export { RESPONDENT_COOKIE } from "./respondent-shared";

/**
 * Read the respondent id from the request cookie without creating anything.
 * Returns null if the visitor has no cookie yet.
 */
export async function getRespondentId(): Promise<string | null> {
  const store = await cookies();
  return store.get(RESPONDENT_COOKIE)?.value ?? null;
}

/**
 * Resolve the current respondent, creating the cookie and the Respondent row if
 * needed. Safe to call from Route Handlers and Server Functions (both may set
 * cookies). Idempotent: repeated calls return the same id and never duplicate
 * the row.
 */
export async function getOrCreateRespondentId(): Promise<string> {
  const store = await cookies();
  let id = store.get(RESPONDENT_COOKIE)?.value;

  if (!id) {
    id = crypto.randomUUID();
    store.set(RESPONDENT_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RESPONDENT_COOKIE_MAX_AGE,
    });
  }

  await prisma.respondent.upsert({
    where: { id },
    create: { id },
    update: {},
  });

  return id;
}
