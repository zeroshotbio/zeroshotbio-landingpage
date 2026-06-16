"use client";
// MarkersPanel — the focused-cluster "Top Markers" panel: UP/DOWN gene bars plus
// the snowballed per-personality chat annotations. Extracted verbatim from
// KasperovClient.tsx; presentational, props-only. Shared by the live wizard and
// the Phase 2 read-only run viewer.
import React from "react";
import type { AgentMode, Cluster, Marker } from "../types";
import { THEME } from "../theme";
import { Typewriter } from "./Typewriter";

export function markerNotes(m: Marker): { via: AgentMode; text: string }[] {
  if (m.notes?.length) return m.notes;
  return m.note ? [{ via: m.via ?? "research", text: m.note }] : [];
}

// one tagged note line: a coloured personality chip + its ≤8-word contribution
function NoteLine({ via, text, scale = 1 }: { via: AgentMode; text: string; scale?: number }) {
  const th = THEME[via] ?? THEME.research;
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, fontSize: 10 * scale, color: "#555", lineHeight: 1.28 }}>
      <span style={{ fontSize: 7.5 * scale, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase", marginRight: 4 }}>{th.name}</span>
      <Typewriter text={text} />
    </div>
  );
}

// chat-contributed annotations, snowballed inline beneath a gene's row — one
// tagged line per personality that has weighed in on the gene
function Annot({ m, scale = 1 }: { m: Marker; scale?: number }) {
  const notes = markerNotes(m);
  if (!notes.length) return null;
  return (
    <div style={{ marginLeft: 60 * scale, marginTop: 1, marginBottom: 2, display: "flex", flexDirection: "column", gap: 1 }}>
      {notes.map((n, i) => (
        <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
      ))}
    </div>
  );
}

function MarkerRow({ m, max, color, scale = 1 }: { m: Marker; max: number; color: string; scale?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 * scale }}>
      <span style={{ width: 66 * scale, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
      <div style={{ flex: 1, height: 6 * scale + 1, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(Math.abs(m.l2fc ?? 0) / max) * 100}%`, height: "100%", background: color }} />
      </div>
      <span style={{ width: 46 * scale, textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>{m.p1 != null ? `${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}</span>
    </div>
  );
}

// a chat-added gene that has floated into the up/down list as a ✦ row
function AddedRow({ m, max, color, scale = 1 }: { m: Marker; max: number; color: string; scale?: number }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, marginLeft: -2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 * scale }}>
        <span style={{ width: 62 * scale, fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
        <div style={{ flex: 1, height: 6 * scale + 1, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          {m.l2fc != null && <div style={{ width: `${(Math.abs(m.l2fc) / max) * 100}%`, height: "100%", background: color }} />}
        </div>
        <span style={{ fontSize: 8 * scale, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase" }}>✦{th.name[0]}</span>
      </div>
      {markerNotes(m).length > 0 && (
        <div style={{ marginLeft: 8, marginTop: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          {markerNotes(m).map((n, i) => (
            <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MarkersContent({ cluster, added }: { cluster: Cluster; added: Marker[] }) {
  const top = cluster.markers.slice(0, 8);
  const down = cluster.markersDown.slice(0, 8);
  const baseUp = new Set(top.map((m) => m.g.toLowerCase()));
  const baseDown = new Set(down.map((m) => m.g.toLowerCase()));
  const listed = new Set<string>([...top.map((m) => m.g.toLowerCase()), ...down.map((m) => m.g.toLowerCase())]);
  // annotations attach to base rows; chat genes with a direction float into the lists
  const annByGene = new Map(added.map((m) => [m.g.toLowerCase(), m]));
  const addedUp = added.filter((m) => m.dir === "up" && !baseUp.has(m.g.toLowerCase()));
  const addedDown = added.filter((m) => m.dir === "down" && !baseDown.has(m.g.toLowerCase()));
  const extra = added.filter((m) => !m.dir && !listed.has(m.g.toLowerCase()));
  const maxUp = Math.max(...top.map((m) => m.l2fc ?? 0), ...addedUp.map((m) => Math.abs(m.l2fc ?? 0)), 1);
  const maxDn = Math.max(...down.map((m) => Math.abs(m.l2fc ?? 0)), ...addedDown.map((m) => Math.abs(m.l2fc ?? 0)), 1);

  // dynamic density: as the snowball grows, shrink text/spacing so the WHOLE
  // UP + DOWN set + notes stays visible without a scrollbar
  const totalNotes = added.reduce((s, m) => s + markerNotes(m).length, 0);
  const lines = top.length + down.length + addedUp.length + addedDown.length + extra.length + totalNotes;
  const scale = lines > 46 ? 0.72 : lines > 38 ? 0.79 : lines > 30 ? 0.86 : lines > 23 ? 0.93 : 1;
  const rowGap = Math.max(1, Math.round(3 * scale));
  const hz = 10 * scale; // section header font

  return (
    <div>
      <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `2px 0 ${rowGap + 1}px` }}>▲ UP-REGULATED</div>
      <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
        {top.map((m) => (
          <React.Fragment key={m.g}>
            <MarkerRow m={m} max={maxUp} color="#8a847b" scale={scale} />
            {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} scale={scale} />}
          </React.Fragment>
        ))}
        {addedUp.map((m) => (
          <AddedRow key={m.g} m={m} max={maxUp} color="#8a847b" scale={scale} />
        ))}
      </div>

      <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `${rowGap + 6}px 0 ${rowGap + 1}px` }}>▼ DOWN-REGULATED</div>
      {down.length || addedDown.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
          {down.map((m) => (
            <React.Fragment key={m.g}>
              <MarkerRow m={m} max={maxDn} color="#b8b2a8" scale={scale} />
              {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} scale={scale} />}
            </React.Fragment>
          ))}
          {addedDown.map((m) => (
            <AddedRow key={m.g} m={m} max={maxDn} color="#b8b2a8" scale={scale} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10.5 * scale, color: "#aaa", lineHeight: 1.35 }}>none computed</div>
      )}

      {extra.length > 0 && (
        <>
          <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `${rowGap + 6}px 0 ${rowGap}px` }}>✦ ALSO DISCUSSED (not yet placed)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: rowGap + 1 }}>
            {extra.map((m) => (
              <div key={m.g} style={{ fontSize: 11 * scale }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{m.g}</span>
                  {m.l2fc != null && <span style={{ color: "#888", fontSize: 10 * scale }}>log2FC {m.l2fc}</span>}
                </div>
                {markerNotes(m).length > 0 && (
                  <div style={{ marginTop: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    {markerNotes(m).map((n, i) => (
                      <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
