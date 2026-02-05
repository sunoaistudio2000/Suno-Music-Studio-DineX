/**
 * Escapes special regex characters so Prisma's case-insensitive contains doesn't break.
 */
function escapeRegexChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a Generation where clause to search by prompt, title, style.
 * Case-insensitive; used by GET /api/generate/search.
 * Splits the query into words for AND logic (e.g. "Reggae 72BPM" finds docs with both words).
 */
export function buildGenerationSearchWhere(q: string, userId: string): Record<string, unknown> {
  const trimmed = q.trim();
  if (!trimmed) return { userId };

  const terms = trimmed.split(/\s+/).filter((t) => t.length > 0);

  return {
    userId,
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: escapeRegexChars(term), mode: "insensitive" as const } },
        { style: { contains: escapeRegexChars(term), mode: "insensitive" as const } },
        { prompt: { contains: escapeRegexChars(term), mode: "insensitive" as const } },
      ],
    })),
  };
}
