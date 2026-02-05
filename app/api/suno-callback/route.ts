import { NextResponse } from "next/server";

/**
 * KIE requires a callBackUrl for Generate Music.
 * This route acknowledges callbacks; the app uses polling for status.
 */
export async function POST() {
  return NextResponse.json({ status: "received" });
}
