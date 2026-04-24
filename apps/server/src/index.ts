import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { runAgent } from "./agent";

const projectId = process.env.PROJECT_ID;
const projectSecret = process.env.PROJECT_SECRET;
const openrouterKey = process.env.OPENROUTER_API_KEY;

if (!projectId || !projectSecret || !openrouterKey) {
  throw new Error(
    "Missing env. Need PROJECT_ID / PROJECT_SECRET (https://app.photon.codes/) and OPENROUTER_API_KEY (https://openrouter.ai/keys) in apps/server/.env",
  );
}

const app = await Spectrum({
  projectId,
  projectSecret,
  providers: [imessage.config()],
  // Split iMessage albums into individual messages — our auto-buffer loop
  // expects one photo per inbound message.
  options: { flattenGroups: true },
});

process.on("SIGINT", () => void app.stop());
process.on("SIGTERM", () => void app.stop());

console.log("girlify listening — agentic mode via openrouter");

for await (const [space, message] of app.messages) {
  // Fire-and-forget so a newer message can arrive and abort an in-flight run
  // inside runAgent. Errors are handled locally to prevent unhandled rejections.
  void space
    .responding(async () => {
      try {
        await runAgent(space, message);
      } catch (err) {
        const e = err as {
          responseBody?: string;
          statusCode?: number;
          message?: string;
          cause?: unknown;
        };
        console.error(`[${space.id}] agent error:`, {
          message: e.message,
          statusCode: e.statusCode,
          responseBody: e.responseBody,
          cause: e.cause,
        });
        await space.send("my brain short-circuited 🫠 try again?");
      }
    })
    .catch((err) => console.error(`[${space.id}] responding wrapper error:`, err));
}
