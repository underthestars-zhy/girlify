"use server";

import { redirect } from "next/navigation";

const SPECTRUM_API = "https://spectrum.photon.codes";

export async function registerAndRedirect(formData: FormData) {
  const projectId = process.env.PROJECT_ID;
  const projectSecret = process.env.PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    throw new Error("Missing PROJECT_ID / PROJECT_SECRET env");
  }

  const dial = String(formData.get("dial") ?? "").replace(/\D/g, "");
  const national = String(formData.get("national") ?? "").replace(/\D/g, "");
  if (!dial || !national) {
    throw new Error("missing phone number");
  }

  const phoneNumber = `+${dial}${national}`;
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");

  const res = await fetch(`${SPECTRUM_API}/projects/${projectId}/users/shared`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phoneNumber }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spectrum register failed (${res.status}): ${body}`);
  }

  const user = (await res.json()) as { id?: string };
  if (!user.id) {
    throw new Error("Spectrum response missing user id");
  }

  const body = encodeURIComponent("girlify me 🥺");
  redirect(`${SPECTRUM_API}/users/${user.id}/redirect?body=${body}`);
}
