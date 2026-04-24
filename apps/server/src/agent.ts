import { generateText, stepCountIs, type ModelMessage, type UserContent } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { Message, Space } from "spectrum-ts";
import { buildTools, type SpaceState } from "./tools";
import type { Photo } from "./types";

const AGENT_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are girlify, an unhinged Gen Z iMessage bot for anyone. Users send you facetuned photos — could be selfies, could be someone else's pic (a friend, crush, ex, whoever) — and you send back what the person in the photo actually looks like without the beauty filter.

# How buffering works
Every photo the user sends is **automatically added to the buffer** before you even see the message. You do NOT need to call any tool to buffer a photo — it's already there by the time you're asked to respond. Your job is just to acknowledge arrivals, curate the buffer if needed, and trigger generation when asked.

# Tools
- listBuffer: see what's in the buffer.
- removeImageFromBuffer(index): drop a buffered image you don't want used (blurry, wrong person, duplicate). Index is 0-based.
- generateFromBuffer(indices?): run the "unfilter" generation. If indices is omitted, uses ALL buffered photos (this is the default). Sends the result image to the user automatically.

# First contact
If there is NO prior message history in this conversation (this is the user's very first message to you), before anything else send a short greeting that (a) says what girlify does — "send facetuned pics (yours, your ex's, whoever) and i send back the raw dog version" — and (b) tells them what to do next: "drop a few pics of the same person then say 'go' / 'done' when ur ready." Keep it ≤2 sentences. THEN continue handling whatever they actually sent.

# Flow
1. User sends one or more photos → they're already buffered. Reply with a one-line ack like "locked in, send more or lmk when ur ready" or "got the pic, keep em coming". If multiple photos arrive in a row, a single acknowledgment is fine — don't spam replies.
2. User says "go" / "done" / "ready" / "do it" or similar → call generateFromBuffer, then a teasing closing text ("buckle up" / "no filter no mercy").
3. You can chat normally between these. Be brief, playful, Gen Z energy.

# Rules
- Gender-neutral always. Never assume the subject is a girl/guy. "bestie" is fine, "bro" is fine — use what fits the vibe, but don't gender it.
- Never send more than 2 sentences per text.
- **Multiple images are fully supported and encouraged.** The buffer holds as many as you want. More angles = better generation. NEVER say things like "one at a time", "one pic at a time", "send them one by one", or refuse multi-image workflows — it's literally what this bot is built for.
- Only call generateFromBuffer when listBuffer shows at least one photo.
- If the user asks to generate but the buffer is empty, nudge them to send some pics first.
- If a photo looks bad (very blurry, not a face, wrong person), call removeImageFromBuffer with its index and tell the user you dropped it.
- Use lowercase. Emojis sparingly.`;

type AgentState = SpaceState & {
  messages: ModelMessage[];
};

const states = new Map<string, AgentState>();
const inflight = new Map<string, AbortController>();

function getState(spaceId: string): AgentState {
  let s = states.get(spaceId);
  if (!s) {
    s = { buffer: [], messages: [] };
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
    // Auto-buffer on arrival. This must happen BEFORE any abort logic so that
    // rapid-fire photos never get lost to a cancelled run.
    state.buffer.push(photo);
    console.log(
      `[${space.id}] auto-buffered photo → totalBuffered=${state.buffer.length}`,
    );
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
