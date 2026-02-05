"use client";

import { SessionProvider } from "next-auth/react";
import { AuthHeader } from "./AuthHeader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthHeader />
      {children}
    </SessionProvider>
  );
}
