import { tool } from "ai";
import { z } from "zod";
import { attachment, type Space } from "spectrum-ts";
import { generateUnfilteredImage } from "./generate";
import type { Photo } from "./types";

export type SpaceState = {
  buffer: Photo[];
  pendingImage: Photo | null;
};

export function buildTools(space: Space, state: SpaceState) {
  return {
    addImageToBuffer: tool({
      description:
        "Add the image from the user's most recent message to the buffer. Call this when a new selfie arrives that should be included in the next generation. Fails if the user's latest message didn't contain an image.",
      inputSchema: z.object({
        reason: z
          .string()
          .optional()
          .describe("Short note on why you're buffering this one (for logs)."),
      }),
      execute: async () => {
        if (!state.pendingImage) {
          return {
            ok: false as const,
            error:
              "No pending image on the current message. The user's latest message was not an image.",
          };
        }
        state.buffer.push(state.pendingImage);
        state.pendingImage = null;
        return {
          ok: true as const,
          index: state.buffer.length - 1,
          totalBuffered: state.buffer.length,
        };
      },
    }),

    removeImageFromBuffer: tool({
      description:
        "Remove a buffered image by its index. Use after the user retracts a photo or you decide one is bad (blurry, duplicate, not a face).",
      inputSchema: z.object({
        index: z.number().int().min(0).describe("0-based index into the buffer."),
      }),
      execute: async ({ index }) => {
        if (index >= state.buffer.length) {
          return { ok: false as const, error: "Index out of range" };
        }
        state.buffer.splice(index, 1);
        return { ok: true as const, totalBuffered: state.buffer.length };
      },
    }),

    listBuffer: tool({
      description: "List what's currently in the image buffer.",
      inputSchema: z.object({}),
      execute: async () => ({
        count: state.buffer.length,
        items: state.buffer.map((p, i) => ({
          index: i,
          mimeType: p.mimeType,
          bytes: p.data.byteLength,
        })),
      }),
    }),

    generateFromBuffer: tool({
      description:
        "Generate the unfiltered image from buffered photos and send the result to the user. If indices is omitted, uses all buffered photos. Clears the buffer on success.",
      inputSchema: z.object({
        indices: z
          .array(z.number().int().min(0))
          .optional()
          .describe("Subset of buffer indices to use. Omit for all."),
      }),
      execute: async ({ indices }) => {
        const chosen = indices
          ? (indices
              .map((i) => state.buffer[i])
              .filter((p): p is Photo => !!p))
          : state.buffer;
        if (chosen.length === 0) {
          return {
            ok: false as const,
            error: "Buffer empty or indices invalid — nothing to generate from.",
          };
        }
        const out = await generateUnfilteredImage(chosen);
        await space.send(
          attachment(Buffer.from(out.data), {
            mimeType: out.mimeType,
            name: "unfiltered.png",
          }),
        );
        state.buffer = [];
        return {
          ok: true as const,
          sent: true,
          bytes: out.data.byteLength,
        };
      },
    }),
  };
}
