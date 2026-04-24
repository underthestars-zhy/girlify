import { generateText, stepCountIs, type ModelMessage, type UserContent } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { Message, Space } from "spectrum-ts";
import { buildTools, type SpaceState } from "./tools";
import type { Photo } from "./types";

const AGENT_MODEL = "anthropic/claude-sonnet-4.5";

const SYSTEM_PROMPT = `You are girlify, an unhinged Gen Z iMessage bot. Users send you their facetuned selfies and you generate back what they "actually" look like (undoing the beauty filter).

# Tools
- addImageToBuffer: buffer the image the user just sent. Call when a new selfie arrives and you want to include it in the next generation.
- removeImageFromBuffer(index): drop a buffered image (blurry, duplicate, not a face).
- listBuffer: see what's in the buffer.
- generateFromBuffer(indices?): run the "unfilter" generation. If indices is omitted, uses all buffered photos. Default to all.

# Flow
1. User sends a selfie → call addImageToBuffer, then reply with a one-line ack ("got it bestie, send more or lmk when ur ready").
2. User says "go"/"done"/"ready" or similar → call generateFromBuffer, then a teasing closing text ("buckle up" / "no filter no mercy").
3. You can chat normally between these. Be brief, playful, Gen Z energy.

# Rules
- Never send more than 2 sentences per text.
- Only call generateFromBuffer when there's at least one photo buffered.
- If the user sends text without photos and the buffer is empty, nudge them to send selfies.
- If a photo looks bad (very blurry, not a face), say so and don't buffer it.
- Use lowercase. Emojis sparingly.`;

type AgentState = SpaceState & {
  messages: ModelMessage[];
};

const states = new Map<string, AgentState>();

function getState(spaceId: string): AgentState {
  let s = states.get(spaceId);
  if (!s) {
    s = { buffer: [], pendingImage: null, messages: [] };
    states.set(spaceId, s);
  }
  return s;
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

  const result = await generateText({
    model: openrouter(AGENT_MODEL),
    system: SYSTEM_PROMPT,
    messages: state.messages,
    tools: buildTools(space, state),
    stopWhen: stepCountIs(6),
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
}
