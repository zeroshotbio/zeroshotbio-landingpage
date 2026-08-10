"use client";
// PaperUploadSection — a drop zone at the very bottom of /daniotype_kasperov for papers,
// supplementary tables and any other source material behind the dataset spec cards above it.
//
// Files are tagged with the dataset they belong to: the chosen dataset id is prefixed onto the
// filename ("zscape__saunders2023_supp.pdf"), because the receiving endpoint writes into one flat
// directory and sanitises away path separators. Prefixing is what keeps a hundred uploads sorted.
//
// Posts to the zfa_judge sidecar's streaming raw endpoint — the same service that backed the old
// EC2 dropzone, which we deliberately left running when that component was removed. Body is raw
// bytes with the filename in the query, so large PDFs stream straight to disk rather than being
// buffered whole. Isolated: it never touches the wizard's state or any run store.
import React, { useRef, useState } from "react";
import { PAPER, INK, ACCENT } from "../theme";

const RAW_URL = "https://zscape.zeroshot.bio/zfa_judge/upload_raw";
const DEST = "/data/scratch/zlabel/data/mappings/uploads/";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const RULE = "#e5e1dc";
const MUTED = "#8a847b";
const FAINT = "#b0a89e";

// The endpoint keeps only [A-Za-z0-9._() -] and takes the basename, so a "<id>__" prefix survives
// intact while anything path-like is stripped. Mirror that here so the name shown is the name saved.
const sanitize = (s: string) => s.replace(/[^A-Za-z0-9._() -]/g, "_").slice(0, 200);

const human = (b: number) =>
  b > 1e9 ? (b / 1e9).toFixed(2) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : b > 1e3 ? (b / 1e3).toFixed(0) + " KB" : b + " B";

type Target = { id: string; name: string };
type Saved = { filename: string; bytes: number };

export default function PaperUploadSection({ datasets }: { datasets: Target[] }) {
  const targets: Target[] = [...datasets, { id: "general", name: "General / unsorted" }];
  // Default to ZSCAPE — it's first in line for source material, and "ZSCAPE Commit Gold" sorts
  // ahead of it, which would be an easy mis-tag on the first upload.
  const [target, setTarget] = useState<string>(
    datasets.some((d) => d.id === "zscape") ? "zscape" : datasets[0]?.id || "general",
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);

  const uploadOne = (f: File, idx: number, count: number) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const name = sanitize(`${target}__${f.name}`);
      setMsg(`Uploading ${name} (${human(f.size)}) — ${idx + 1}/${count}`);
      setPct(0);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${RAW_URL}?name=${encodeURIComponent(name)}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((100 * e.loaded) / e.total)); };
      xhr.onload = () => {
        let j: { ok?: boolean; saved?: Saved[]; error?: string } = {};
        try { j = JSON.parse(xhr.responseText); } catch { /* non-JSON error body */ }
        if (xhr.status === 200 && j.ok) { setSaved((prev) => [...(j.saved || []), ...prev]); resolve({ ok: true }); }
        else resolve({ ok: false, error: j.error || `HTTP ${xhr.status}` });
      };
      xhr.onerror = () => resolve({ ok: false, error: "network error" });
      xhr.send(f); // streams the File body straight through
    });

  async function send(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true); setErr(null); setMsg(null); setPct(0);
    const failures: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const r = await uploadOne(list[i], i, list.length);
      if (!r.ok) failures.push(`${list[i].name}: ${r.error}`);
    }
    setBusy(false); setPct(0);
    if (failures.length) { setErr(`Some uploads failed — ${failures.join("; ")}`); setMsg(null); }
    else setMsg(`✓ Uploaded ${list.length} file${list.length === 1 ? "" : "s"} — on the EC2 now.`);
  }

  const label = targets.find((t) => t.id === target)?.name || target;

  return (
    <section style={{ background: PAPER, color: INK, padding: "30px 20px 64px", borderTop: `1px solid ${RULE}` }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", marginBottom: 4 }}>
          📄 Source material
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, margin: "0 0 14px", maxWidth: 720 }}>
          Papers, supplementary tables, methods sections — anything backing the cards above. Pick the
          dataset first so the file lands tagged; the name is prefixed with its id.
        </p>

        {/* dataset tag — which card this upload belongs to */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {targets.map((t) => {
            const on = t.id === target;
            return (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                title={`Tag uploads as ${t.name} — saved as ${t.id}__<filename>`}
                style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, borderRadius: 99, padding: "4px 11px",
                  cursor: "pointer", whiteSpace: "nowrap",
                  color: on ? "#fff" : MUTED,
                  background: on ? ACCENT : "#fffdfb",
                  border: `1px solid ${on ? ACCENT : RULE}`,
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer?.files?.length) send(e.dataTransfer.files); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            minHeight: 132, border: `2px dashed ${drag ? ACCENT : "#d8d3cd"}`, borderRadius: 14,
            background: drag ? "#eaf6f8" : "#fffdfb", cursor: "pointer", textAlign: "center", padding: 22,
            transition: "border-color .12s, background .12s",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.tsv,.txt,.xls,.xlsx,.xlsm,.zip,.json,.md,.docx,.gz"
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) send(e.target.files); e.target.value = ""; }}
          />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Drag files here, or click to choose</div>
          <div style={{ fontSize: 11.5, color: MUTED }}>
            Tagging as <strong style={{ color: ACCENT }}>{label}</strong> — PDF · CSV · TSV · XLS/XLSX · ZIP · TXT
          </div>
          <div style={{ fontSize: 10.5, color: FAINT, fontFamily: MONO }}>
            → {DEST}{target}__&lt;filename&gt;
          </div>
        </label>

        <div style={{ marginTop: 10, fontSize: 12.5, minHeight: 18 }}>
          {busy && <span style={{ color: MUTED }}>{msg}{pct > 0 ? ` ${pct}%` : ""}</span>}
          {!busy && err && <span style={{ color: "#d23b3b", fontWeight: 700 }}>{err}</span>}
          {!busy && !err && msg && <span style={{ color: "#1e9e57", fontWeight: 700 }}>{msg}</span>}
        </div>

        {saved.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>
              Landed this session ({saved.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: MUTED }}>
              {saved.map((s, i) => (
                <li key={i} style={{ fontFamily: MONO, lineHeight: 1.6 }}>
                  {s.filename} <span style={{ color: FAINT }}>({human(s.bytes)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 10.5, color: FAINT, fontStyle: "italic", lineHeight: 1.5 }}>
          Up to 8 GB per file. Uploading a file whose tagged name already exists replaces it, so
          version the filename if you want to keep both.
        </div>
      </div>
    </section>
  );
}
