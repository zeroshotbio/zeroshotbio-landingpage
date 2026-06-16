"use client";
// ImportButton — hidden file input + a ghost button that parses a dropped JSON
// run file and hands it to onImport. Extracted verbatim from KasperovClient.tsx;
// shared by the wizard (MapStage) and the Scorecard.
import React, { useRef } from "react";
import { btnGhost } from "../theme";

export function ImportButton({ onImport, label, style }: { onImport: (data: unknown) => void; label: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            try {
              onImport(JSON.parse(String(r.result)));
            } catch {
              window.alert("Couldn't parse that file as JSON.");
            }
          };
          r.readAsText(f);
          e.target.value = ""; // let the same file be re-picked
        }}
      />
      <button onClick={() => ref.current?.click()} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14, ...style }}>
        {label}
      </button>
    </>
  );
}
