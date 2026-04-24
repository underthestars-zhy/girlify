import type { Photo } from "./types";

const PROMPT =
  "这些照片都是一个人，但是这些照片都经过美颜，请参考这些照片，在第一张照片上还原出这位女生没有美颜过的形象";
const MODEL = "google/gemini-3-pro-image-preview";

export async function generateUnfilteredImage(photos: Photo[]): Promise<Photo> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) throw new Error("Missing OPENROUTER_API_KEY");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://girlify.app",
      "X-Title": "girlify",
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            ...photos.map((p) => ({
              type: "image_url",
              image_url: {
                url: `data:${p.mimeType};base64,${Buffer.from(p.data).toString("base64")}`,
              },
            })),
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: { images?: Array<{ image_url?: { url?: string } }> };
    }>;
  };

  const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) {
    throw new Error(`No image in response: ${JSON.stringify(json).slice(0, 500)}`);
  }

  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Malformed data URL in response");
  const mime = match[1]!;
  const b64 = match[2]!;
  return { data: new Uint8Array(Buffer.from(b64, "base64")), mimeType: mime };
}
