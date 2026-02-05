"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { TITLE_GRADIENT } from "@/components/shared/AppTitle";

export function AuthHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="flex items-center justify-end py-3 px-4 border-b border-[#2a2a2a]">
      {status === "loading" ? (
        <span className="text-sm text-gray-500">Loading…</span>
      ) : session?.user ? (
        <div className="flex flex-wrap items-center gap-3">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
              width={24}
              height={24}
            />
          ) : null}
          <span className="text-sm text-gray-400 truncate max-w-[180px]">
            {session.user.email ?? session.user.name ?? "Signed in"}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="rounded-lg border-0 px-4 py-2 text-sm font-medium text-white shadow-md transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
          style={{ backgroundImage: TITLE_GRADIENT }}
        >
          Sign in with Google
        </button>
      )}
    </header>
  );
}
