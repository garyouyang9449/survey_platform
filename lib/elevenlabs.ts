const API_BASE = "https://api.elevenlabs.io";

export interface TranscriptTurn {
  role: "user" | "agent";
  message: string | null;
  time_in_call_secs?: number;
}

export interface ElevenLabsConversation {
  conversation_id: string;
  status: string; // e.g. "processing" | "done"
  transcript: TranscriptTurn[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
  };
}

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return key;
}

/**
 * Mint a short-lived (~10 min) WebRTC conversation token for a private agent.
 * Server-only: the API key must never reach the browser. The client passes the
 * returned token to `useConversation().startSession({ conversationToken })`.
 */
export async function getConversationToken(agentId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey() }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to get conversation token (${res.status}): ${await safeText(res)}`,
    );
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Fetch a conversation's details + transcript by id. */
export async function getConversation(
  conversationId: string,
): Promise<ElevenLabsConversation> {
  const res = await fetch(
    `${API_BASE}/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
    { headers: { "xi-api-key": apiKey() }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to get conversation ${conversationId} (${res.status}): ${await safeText(res)}`,
    );
  }
  return (await res.json()) as ElevenLabsConversation;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
