import { NextResponse } from "next/server";

/**
 * Validate that required string fields are present and non-empty.
 * Returns a NextResponse with 422 if validation fails, otherwise null.
 * @param customMessage - Optional message when any field fails (e.g. "In custom mode, style and title are required")
 */
export function validateRequired(
  body: Record<string, unknown>,
  required: string[],
  customMessage?: string
): NextResponse | null {
  for (const key of required) {
    const val = body[key];
    if (val == null || (typeof val === "string" && !val.trim())) {
      return NextResponse.json(
        { error: customMessage ?? `${key} is required` },
        { status: 422 }
      );
    }
  }
  return null;
}
