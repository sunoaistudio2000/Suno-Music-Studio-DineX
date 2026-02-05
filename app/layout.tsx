import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Suno Music Studio",
  description: "Create and manage music with Suno",
  icons: {
    icon: "https://www.suno.com/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
