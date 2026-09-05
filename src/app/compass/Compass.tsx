"use client";
import Wildtype from "./Wildtype";
import Flotilla from "./Flotilla";

// Two rivers side by side: the wild-type reference (what "normal" looks like, 0 → 96 hpf) on the
// left, the drug's shared-response flotilla on the right. Same isometric language, separate scenes.
export default function Compass({ fontClass }: { fontClass: string }) {
  return (
    <div className={fontClass} style={{ position: "fixed", inset: 0, background: "#0e1116", color: "#c7d0da", display: "grid", gridTemplateColumns: "1fr 1px 1fr", overflow: "hidden" }}>
      <style>{`text{font-family:inherit}`}</style>
      <Wildtype />
      <div style={{ background: "#232b36" }} />
      <Flotilla />
    </div>
  );
}
