/** Base URL for Suno callback endpoint. Used by all generation API routes. */
export function getCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/suno-callback`;
}
