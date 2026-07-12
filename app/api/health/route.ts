import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Redact any credentials/URLs from an error message before returning it. */
function sanitize(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"]+/gi, "postgres://<redacted>")
    .split("\n")
    .slice(0, 4)
    .join(" ");
}

/**
 * GET /api/health
 * Diagnostic endpoint: reports env-var presence (never values) and whether the
 * database is reachable. Safe to expose temporarily to debug deploys.
 */
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
    ELEVENLABS_AGENT_ID: Boolean(process.env.ELEVENLABS_AGENT_ID),
    NODE_ENV: process.env.NODE_ENV ?? null,
  };

  let db: { ok: boolean; error?: string } = { ok: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true };
  } catch (err) {
    db = {
      ok: false,
      error: err instanceof Error ? sanitize(err.message) : "unknown error",
    };
  }

  return NextResponse.json({ env, db }, { status: db.ok ? 200 : 500 });
}
