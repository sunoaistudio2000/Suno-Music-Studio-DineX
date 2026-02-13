/** Shared stepper icons for numeric form controls. */
export const PlusIcon = () => (
  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 12 12">
    <path d="M6 3v6M3 6h6" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const MinusIcon = () => (
  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 12 12">
    <path d="M4 6h4" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** Stem separation: Vocals (microphone style). */
export const VocalsStemIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

/** Stem separation: Instrumental (musical note). */
export const InstrumentalStemIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);
