"use client";
// useTween — tween a number toward `target` with ease-in-out (accelerate then
// decelerate). Extracted verbatim from KasperovClient.tsx; shared by the wizard
// (projected-cost roll-up) and ConfidencePanel (tier bars).
import { useEffect, useRef, useState } from "react";

export function useTween(target: number, duration = 1100): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    if (typeof requestAnimationFrame === "undefined" || typeof performance === "undefined") {
      fromRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // easeInOutQuad
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(from + (to - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}
