"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedPersona } from "@/app/types";

/**
 * Manage persona list: prefer prop-provided personas, otherwise fetch from API.
 * Also listens for the "persona-created" event to refresh automatically.
 */
export function usePersonas(personasProp?: SavedPersona[]) {
  const [personas, setPersonas] = useState<SavedPersona[]>([]);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch("/api/personas");
      const data = await res.json();
      if (res.ok && Array.isArray(data.personas)) setPersonas(data.personas);
      else setPersonas([]);
    } catch {
      setPersonas([]);
    }
  }, []);

  // Prefer prop personas; fall back to fetch
  useEffect(() => {
    if (personasProp && personasProp.length > 0) {
      setPersonas(personasProp);
    } else {
      fetchPersonas();
    }
  }, [personasProp, fetchPersonas]);

  // Re-fetch on persona-created event (only when not prop-controlled)
  useEffect(() => {
    const onCreated = () => {
      if (!personasProp) fetchPersonas();
    };
    window.addEventListener("persona-created", onCreated);
    return () => window.removeEventListener("persona-created", onCreated);
  }, [personasProp, fetchPersonas]);

  return personas;
}
