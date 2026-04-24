"use server";

import { redirect } from "next/navigation";

const SPECTRUM_API = "https://spectrum.photon.codes";

type SpectrumUser = { id: string; phoneNumber?: string };
type SpectrumEnvelope<T> = T | { data?: T; succeed?: boolean };

function unwrap<T>(body: SpectrumEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body && body.data != null) {
    return body.data as T;
  }
  return body as T;
}

async function findExistingUser(
  projectId: string,
  auth: string,
  phoneNumber: string,
): Promise<string | null> {
  const res = await fetch(
    `${SPECTRUM_API}/projects/${projectId}/users/?type=shared`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) return null;
  const data = unwrap<{ users?: SpectrumUser[] }>(await res.json());
  const users = data?.users;
  if (!Array.isArray(users)) return null;
  return users.find((u) => u.phoneNumber === phoneNumber)?.id ?? null;
}

export async function registerAndRedirect(formData: FormData) {
  const projectId = process.env.PROJECT_ID;
  const projectSecret = process.env.PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    throw new Error("Missing PROJECT_ID / PROJECT_SECRET env");
  }

  const dial = String(formData.get("dial") ?? "").replace(/\D/g, "");
  const national = String(formData.get("national") ?? "").replace(/\D/g, "");
  if (!dial || !national) throw new Error("missing phone number");

  const phoneNumber = `+${dial}${national}`;
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");

  const res = await fetch(
    `${SPECTRUM_API}/projects/${projectId}/users/shared`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber }),
    },
  );

  let userId: string | null = null;
  if (res.ok) {
    const user = unwrap<SpectrumUser>(await res.json());
    userId = user?.id ?? null;
  } else if (res.status === 409) {
    userId = await findExistingUser(projectId, auth, phoneNumber);
  } else {
    throw new Error(`Spectrum register failed (${res.status}): ${await res.text()}`);
  }

  if (!userId) throw new Error("could not resolve user id");

  const msg = encodeURIComponent("girlify me 🥺");
  redirect(`${SPECTRUM_API}/users/${userId}/redirect?msg=${msg}`);
}
