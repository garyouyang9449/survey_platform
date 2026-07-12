import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://user:pass@host:5432/db",
  ELEVENLABS_API_KEY: "sk_test_123",
  ELEVENLABS_AGENT_ID: "agent_123",
};

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.ELEVENLABS_API_KEY).toBe(valid.ELEVENLABS_API_KEY);
    expect(env.ELEVENLABS_AGENT_ID).toBe(valid.ELEVENLABS_AGENT_ID);
  });

  it("throws a clear error when a variable is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    void DATABASE_URL;
    expect(() => parseEnv(rest)).toThrowError(/DATABASE_URL/);
  });

  it("throws when a variable is empty", () => {
    expect(() => parseEnv({ ...valid, ELEVENLABS_API_KEY: "" })).toThrowError(
      /ELEVENLABS_API_KEY/,
    );
  });
});
