import { Spectrum, attachment } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

const projectId = process.env.PROJECT_ID;
const projectSecret = process.env.PROJECT_SECRET;
const openrouterKey = process.env.OPENROUTER_API_KEY;

if (!projectId || !projectSecret || !openrouterKey) {
  throw new Error(
    "Missing env. Need PROJECT_ID / PROJECT_SECRET (https://app.photon.codes/) and OPENROUTER_API_KEY (https://openrouter.ai/keys) in apps/server/.env",
  );
}

const PROMPT =
  "这些照片都是一个人，但是这些照片都经过美颜，请参考这些照片，在第一张照片上还原出这位女生没有美颜过的形象";
const MODEL = "google/gemini-3-pro-image-preview";

type Photo = { data: Uint8Array; mimeType: string };

async function generate(photos: Photo[]): Promise<Photo> {
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
      message?: {
        images?: Array<{ image_url?: { url?: string } }>;
      };
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

const app = await Spectrum({
  projectId,
  projectSecret,
  providers: [imessage.config()],
});

process.on("SIGINT", () => void app.stop());
process.on("SIGTERM", () => void app.stop());

const buffers = new Map<string, Photo[]>();

console.log(`girlify listening — model=${MODEL}`);

for await (const [space, message] of app.messages) {
  if (
    message.content.type === "attachment" &&
    message.content.mimeType.startsWith("image/")
  ) {
    const bytes = await message.content.read();
    const buf = buffers.get(space.id) ?? [];
    buf.push({
      data: new Uint8Array(bytes),
      mimeType: message.content.mimeType,
    });
    buffers.set(space.id, buf);
    console.log(`[${space.id}] buffered photo #${buf.length} (${message.content.mimeType})`);
    await message.react("like");
    continue;
  }

  if (message.content.type !== "text") continue;

  const photos = buffers.get(space.id);
  if (!photos?.length) {
    await space.send("send me pics first bestie 📸");
    continue;
  }

  buffers.delete(space.id);
  console.log(`[${space.id}] generating from ${photos.length} photos`);

  await space.responding(async () => {
    try {
      const out = await generate(photos);
      await space.send(
        attachment(Buffer.from(out.data), {
          mimeType: out.mimeType,
          name: "unfiltered.png",
        }),
      );
      console.log(`[${space.id}] sent generated image (${out.data.byteLength} bytes)`);
    } catch (err) {
      console.error(`[${space.id}] generate failed:`, err);
      await space.send("oof the ai ghosted us. try again?");
    }
  });
}
