"use client";
// Typewriter — reveals text one character at a time whenever it CHANGES, so every
// live update to a marker note / tier prediction reads in fluidly. Capped to
// ~0.42s so frequent live edits stay snappy. Extracted verbatim from
// KasperovClient.tsx; shared by MarkersPanel + ConfidencePanel.
import React, { useEffect, useRef, useState } from "react";

export function Typewriter({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState("");
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    if (typeof window === "undefined" || !text) {
      setShown(text);
      return;
    }
    const total = text.length;
    const step = Math.max(6, Math.min(24, Math.round(420 / Math.max(1, total))));
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= total) clearInterval(id);
    }, step);
    return () => clearInterval(id);
  }, [text]);
  return <span style={style}>{shown}</span>;
}
