import { generateText, stepCountIs, type ModelMessage, type UserContent } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { Message, Space } from "spectrum-ts";
import { buildTools, type SpaceState } from "./tools";
import type { Photo } from "./types";

const AGENT_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are girlify, an unhinged Gen Z iMessage bot for anyone — guys, girls, nonbinary, whoever. Users send you their facetuned selfies and you generate back what they "actually" look like (undoing the beauty filter).

# Tools
- addImageToBuffer: buffer the image the user just sent. Call when a new selfie arrives and you want to include it in the next generation.
- removeImageFromBuffer(index): drop a buffered image (blurry, duplicate, not a face).
- listBuffer: see what's in the buffer.
- generateFromBuffer(indices?): run the "unfilter" generation. If indices is omitted, uses all buffered photos. Default to all.

# First contact
If there is NO prior message history in this conversation (this is the user's very first message to you), before anything else send a short greeting that (a) says what girlify does — "send your facetuned selfies, i send back the raw dog version" — and (b) tells them what to do next: "drop a few pics then say 'go' / 'done' when ur ready." Keep it ≤2 sentences. THEN continue handling whatever they actually sent.

# Flow
1. User sends a selfie → call addImageToBuffer, then reply with a one-line ack ("got it bestie, send more or lmk when ur ready").
2. User says "go" / "done" / "ready" or similar → call generateFromBuffer, then a teasing closing text ("buckle up" / "no filter no mercy").
3. You can chat normally between these. Be brief, playful, Gen Z energy.

# Rules
- Gender-neutral always. Never assume the subject is a girl/guy. "bestie" is fine, "bro" is fine — use what fits the vibe, but don't gender it.
- Never send more than 2 sentences per text.
- Only call generateFromBuffer when there's at least one photo buffered.
- If the user sends text without photos and the buffer is empty, nudge them to send selfies.
- If a photo looks bad (very blurry, not a face), say so and don't buffer it.
- Use lowercase. Emojis sparingly.`;

type AgentState = SpaceState & {
  messages: ModelMessage[];
};

const states = new Map<string, AgentState>();
const inflight = new Map<string, AbortController>();

function getState(spaceId: string): AgentState {
  let s = states.get(spaceId);
  if (!s) {
    s = { buffer: [], pendingImage: null, messages: [] };
    states.set(spaceId, s);
  }
  return s;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return e.name === "AbortError" || /aborted|cancell?ed/i.test(e.message ?? "");
}

export async function runAgent(space: Space, inbound: Message): Promise<void> {
  const state = getState(space.id);

  const parts: UserContent = [];
  if (inbound.content.type === "text") {
    parts.push({ type: "text", text: inbound.content.text });
  } else if (
    inbound.content.type === "attachment" &&
    inbound.content.mimeType.startsWith("image/")
  ) {
    const bytes = new Uint8Array(await inbound.content.read());
    const photo: Photo = { data: bytes, mimeType: inbound.content.mimeType };
    state.pendingImage = photo;
    parts.push({ type: "image", image: bytes, mediaType: inbound.content.mimeType });
  } else {
    return;
  }

  state.messages.push({ role: "user", content: parts });

  // A new message invalidates any in-flight agent run for this space. Abort it
  // so the fresh run sees the complete updated history.
  const prev = inflight.get(space.id);
  if (prev) {
    prev.abort();
    console.log(`[${space.id}] aborted previous run — superseded by new message`);
  }

  const ctrl = new AbortController();
  inflight.set(space.id, ctrl);

  try {
    const result = await generateText({
      model: openrouter(AGENT_MODEL),
      system: SYSTEM_PROMPT,
      messages: state.messages,
      tools: buildTools(space, state),
      stopWhen: stepCountIs(6),
      abortSignal: ctrl.signal,
    });

    state.messages.push(...result.response.messages);
    state.pendingImage = null;

    const text = result.text.trim();
    if (text) {
      await space.send(text);
    }

    console.log(
      `[${space.id}] steps=${result.steps.length} tools=${result.steps
        .flatMap((s) => s.toolCalls.map((c) => c.toolName))
        .join(",") || "none"} reply=${text.slice(0, 80) || "(empty)"}`,
    );
  } catch (err) {
    if (isAbortError(err) || ctrl.signal.aborted) {
      console.log(`[${space.id}] run aborted — swallowing`);
      return;
    }
    throw err;
  } finally {
    if (inflight.get(space.id) === ctrl) inflight.delete(space.id);
  }
}
