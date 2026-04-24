import { PhoneForm } from "./phone-form";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#fff6e3] px-6 py-16 text-black">
      <div className="relative mx-auto flex w-full max-w-lg flex-col gap-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#ff2d87] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-[#3b82f6] opacity-30 blur-3xl" />

        <header className="relative flex flex-col items-center gap-4 text-center">
          <span className="rounded-full border-2 border-black bg-white px-4 py-1 text-sm font-bold uppercase tracking-widest">
            ✦ the filter police ✦
          </span>
          <h1 className="text-6xl font-black leading-none tracking-tighter sm:text-7xl">
            girl<span className="text-[#ff2d87]">ify</span>
          </h1>
          <p className="max-w-sm text-balance text-lg font-semibold text-zinc-800">
            text us facetuned pics — yours, your ex's, whoever's. we send back what they{" "}
            <span className="bg-[#ffe74c] px-1 italic">actually</span> look like.
          </p>
          <p className="max-w-sm text-sm font-medium text-zinc-600">
            brutal honesty over imessage. we warned you. 💀
          </p>
        </header>

        <div className="relative rounded-3xl border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_#000]">
          <PhoneForm />
        </div>

        <footer className="relative flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span>made with</span>
          <span className="text-[#ff2d87]">♥</span>
          <span>and zero chill</span>
        </footer>
      </div>
    </main>
  );
}
