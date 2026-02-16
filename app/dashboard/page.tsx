"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppTitleWithLogo } from "@/components/shared/AppTitle";
import { SharedTracksGrid } from "@/components/dashboard/SharedTracksGrid";

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <AppTitleWithLogo className="mb-6" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex justify-center">
          <AppTitleWithLogo href="/" className="mb-0" />
        </div>

        <section aria-labelledby="shared-tracks-heading">
          <h2 id="shared-tracks-heading" className="mb-6 text-xl font-semibold text-[#f5f5f5]">
            Shared Tracks
          </h2>
          <SharedTracksGrid />
        </section>
      </div>
    </main>
  );
}
