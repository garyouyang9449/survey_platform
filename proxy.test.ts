import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { RESPONDENT_COOKIE } from "./lib/respondent-shared";

function makeRequest(url: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${RESPONDENT_COOKIE}=${cookie}`);
  return new NextRequest(new URL(url, "http://localhost"), { headers });
}

describe("proxy respondent identity", () => {
  it("issues a respondent cookie on first visit", () => {
    const res = proxy(makeRequest("/"));
    const setCookie = res.cookies.get(RESPONDENT_COOKIE);
    expect(setCookie?.value).toBeTruthy();
    expect(setCookie?.httpOnly).toBe(true);
    expect(setCookie?.sameSite).toBe("lax");
  });

  it("does not overwrite an existing respondent cookie", () => {
    const res = proxy(makeRequest("/", "existing-id-123"));
    // No new cookie is set when one already exists.
    expect(res.cookies.get(RESPONDENT_COOKIE)).toBeUndefined();
  });

  it("issues distinct ids across separate first visits", () => {
    const a = proxy(makeRequest("/")).cookies.get(RESPONDENT_COOKIE)?.value;
    const b = proxy(makeRequest("/")).cookies.get(RESPONDENT_COOKIE)?.value;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
