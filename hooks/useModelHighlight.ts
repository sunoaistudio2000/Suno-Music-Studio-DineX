"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Flash a highlight flag for 3 seconds whenever `model` changes.
 * Used to draw attention to model-dependent tooltips (prompt/style char limits).
 */
export function useModelHighlight(model: string) {
  const [highlighted, setHighlighted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prev = useRef(model);

  useEffect(() => {
    if (model === prev.current) return;
    prev.current = model;
    setHighlighted(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlighted(false), 3000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [model]);

  return highlighted;
}
