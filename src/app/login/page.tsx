"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 bg-cover bg-center relative"
      style={{ backgroundImage: "url(/theme/bg-login.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm flex flex-col items-center gap-8">
        <Image
          src="/theme/mego-wordmark.png"
          alt="MEGO"
          width={300}
          height={77}
          priority
          className="rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
        />
        <div className="panel w-full p-6 backdrop-blur-sm bg-black/60!">
          <h1 className="text-xl text-center mb-1 text-goldbright">
            The Gate Awaits
          </h1>
          <p className="text-center text-muted text-sm mb-6">
            Identify yourself, Assassin.
          </p>
          <form action={action} className="flex flex-col gap-4">
            <div>
              <label className="field" htmlFor="username">Codename</label>
              <input
                id="username"
                name="username"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </div>
            <div>
              <label className="field" htmlFor="password">Passphrase</label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
              />
            </div>
            {state?.error && (
              <p className="text-bloodbright text-sm text-center">{state.error}</p>
            )}
            <button className="btn btn-gold w-full" disabled={pending}>
              {pending ? "Verifying…" : "Enter the Brotherhood"}
            </button>
          </form>
        </div>
        <Link href="/check" className="text-muted text-sm underline underline-offset-4 hover:text-goldbright">
          Just checking a ticket? Verify it here →
        </Link>
      </div>
    </main>
  );
}
