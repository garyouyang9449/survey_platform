import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConversationToken, getConversation } from "./elevenlabs";

const OLD_KEY = process.env.ELEVENLABS_API_KEY;

beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = "sk_test_key";
});

afterEach(() => {
  process.env.ELEVENLABS_API_KEY = OLD_KEY;
  vi.restoreAllMocks();
});

describe("getConversationToken", () => {
  it("calls the token endpoint with the api key and returns the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "tok_123" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const token = await getConversationToken("agent_abc");
    expect(token).toBe("tok_123");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/convai/conversation/token?agent_id=agent_abc");
    expect(opts.headers["xi-api-key"]).toBe("sk_test_key");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 })),
    );
    await expect(getConversationToken("agent_abc")).rejects.toThrow(/401/);
  });
});

describe("getConversation", () => {
  it("fetches a conversation transcript by id", async () => {
    const payload = {
      conversation_id: "conv_1",
      status: "done",
      transcript: [{ role: "agent", message: "Hi", time_in_call_secs: 1 }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const conv = await getConversation("conv_1");
    expect(conv.conversation_id).toBe("conv_1");
    expect(conv.transcript).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/v1/convai/conversations/conv_1",
    );
  });
});
