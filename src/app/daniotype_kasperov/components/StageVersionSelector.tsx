// StageVersionSelector — the version picker that sits at the top of a pipeline stage in the New Run
// wizard. Left: the stage's selectable versions as pills + a "What's different?" toggle that expands
// plain-english notes per version. Right: a caller-supplied slot (the stage's Proceed button).
"use client";
import React from "react";
import { ACCENT, INK } from "../theme";
import { versionsFor, type PipelineStage, type VersionStatus } from "../pipeline_versions";

const STAGE_TITLE: Record<PipelineStage, string> = {
  clustering: "Clustering",
  labelling: "Labelling",
  merging: "Merging",
  judge: "Judge",
};

// status → small tag styling; drives the pill's sub-tag and the expanded card's chip.
const STATUS_TAG: Record<VersionStatus, { label: string; fg: string; bg: string }> = {
  current: { label: "recommended", fg: "#15803d", bg: "#ecfdf5" },
  supported: { label: "supported", fg: "#5a544c", bg: "#f0ede9" },
  legacy: { label: "legacy", fg: "#92600a", bg: "#fef6e3" },
  defective: { label: "superseded", fg: "#9a3412", bg: "#fff2ec" },
  unspecified: { label: "unpinned", fg: "#6b7280", bg: "#f3f4f6" },
};

export function StageVersionSelector({
  stage,
  datasetId,
  value,
  onChange,
  right,
}: {
  stage: PipelineStage;
  datasetId: string;
  value: string;
  onChange: (v: string) => void;
  right?: React.ReactNode;
}) {
  const versions = versionsFor(datasetId, stage);
  const sel = versions.find((v) => v.version === value) ?? versions[versions.length - 1];

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto 18px",
        background: "#fffdfb",
        border: "1px solid #e5e1dc",
        borderRadius: 14,
        padding: "12px 14px",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#9a948c",
              marginBottom: 7,
            }}
          >
            {STAGE_TITLE[stage]} version
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {versions.map((v) => {
              const on = v.version === sel.version;
              const tag = STATUS_TAG[v.status];
              return (
                <button
                  key={v.version}
                  onClick={() => onChange(v.version)}
                  title={v.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: on ? ACCENT : "#fff",
                    color: on ? "#fff" : INK,
                    border: `1px solid ${on ? ACCENT : "#dcd7d0"}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {v.version}
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      padding: "1px 5px",
                      borderRadius: 999,
                      color: on ? "#fff" : tag.fg,
                      background: on ? "rgba(255,255,255,0.22)" : tag.bg,
                    }}
                  >
                    {tag.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
      </div>
    </div>
  );
}
