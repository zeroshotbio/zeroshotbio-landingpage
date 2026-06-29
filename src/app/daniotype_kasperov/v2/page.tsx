// daniotype_kasperov / v2 — STAGING trace viewer for the v2.0 harness MVP.
//
// Walk the recorded trace of the v2.0 "top-down expectation-guided recursion" run in
// judgement mode: coarse-first calls → expected-tissue gap check → selective routing →
// sub-leaf calls with top-down context. Read-only review surface; NOT the served harness,
// NOT wired into production. URL: /daniotype_kasperov/v2 (behind the existing Basic-Auth).
import V2TraceViewer from "./V2TraceViewer";

export const metadata = {
  title: "daniotype · kasperov — v2.0 harness trace (staging)",
  description: "Walk the v2.0 top-down expectation-guided recursion trace in judgement mode. Staging only.",
};

export default function V2Page() {
  return <V2TraceViewer />;
}
