"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import { registerAndRedirect } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-2xl bg-black px-6 py-5 text-xl font-black uppercase tracking-tight text-white shadow-[6px_6px_0_0_#ff2d87] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_#ff2d87] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:opacity-60"
    >
      {pending ? "summoning the oracle ✨..." : "expose me 😭"}
    </button>
  );
}

export function PhoneForm() {
  const [iso, setIso] = useState(DEFAULT_COUNTRY.iso);
  const country = COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;

  return (
    <form action={registerAndRedirect} className="flex flex-col gap-4">
      <input type="hidden" name="dial" value={country.dial} />
      <div className="flex gap-2">
        <select
          aria-label="Country"
          value={iso}
          onChange={(e) => setIso(e.target.value)}
          className="w-36 rounded-2xl border-4 border-black bg-white px-3 py-4 text-lg font-bold text-black focus:outline-none focus:ring-4 focus:ring-[#ff2d87]"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          name="national"
          inputMode="tel"
          autoComplete="tel-national"
          required
          placeholder="your digits"
          className="flex-1 rounded-2xl border-4 border-black bg-white px-4 py-4 text-lg font-bold text-black placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-[#ff2d87]"
        />
      </div>
      <SubmitButton />
      <p className="text-center text-sm font-medium text-zinc-600">
        we'll slide into your dms. no spam, pinky promise 🤙
      </p>
    </form>
  );
}
