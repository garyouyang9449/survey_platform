import { z } from "zod";

/**
 * Server-side environment variables. These are never exposed to the client.
 * `ELEVENLABS_API_KEY` in particular must only ever be read inside server code
 * (route handlers / server components), never shipped to the browser.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Trim to defend against stray whitespace/newlines from dashboard copy-paste,
  // which otherwise produces confusing "invalid agent id" / auth errors.
  ELEVENLABS_API_KEY: z
    .string()
    .trim()
    .min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_AGENT_ID: z
    .string()
    .trim()
    .min(1, "ELEVENLABS_AGENT_ID is required"),
});

export type ServerEnv = z.infer<typeof envSchema>;

/**
 * Pure, testable parser. Throws a readable error listing the offending keys.
 */
export function parseEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Lazily validate and memoize the server environment. Call this from server
 * code only. Validation is deferred until first use so tooling (and tests)
 * that don't need env vars don't blow up at import time.
 */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}
