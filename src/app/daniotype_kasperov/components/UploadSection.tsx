"use client";
// UploadSection — a drag-and-drop / click file uploader at the bottom of the kasperov page.
// Posts to the zfa_judge sidecar's generic /upload endpoint (multipart, CORS-enabled), which
// saves each file to data/mappings/uploads/ on the EC2 box — a landing zone for sharing files.
// Isolated: it never touches the wizard's state or any run store.
import React, { useRef, useState } from "react";
import { PAPER, INK, ACCENT } from "../theme";

// Streaming raw endpoint — one request per file, body = raw bytes, filename in the query.
// Streams straight to disk on the box (no multipart, no whole-file buffering), so large .h5ad
// files (100s of MB) upload without hanging.
const RAW_URL = "https://zscape.zeroshot.bio/zfa_judge/upload_raw";

function human(b: number): string {
  return b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : b > 1e3 ? (b / 1e3).toFixed(0) + " KB" : b + " B";
}

type Saved = { filename: string; bytes: number };

export default function UploadSection() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);

  function uploadOne(f: File, idx: number, count: number): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      setMsg(`Uploading ${f.name} (${human(f.size)}) — ${idx + 1}/${count}`); setPct(0);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${RAW_URL}?name=${encodeURIComponent(f.name)}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((100 * e.loaded) / e.total)); };
      xhr.onload = () => {
        let j: { ok?: boolean; saved?: Saved[]; error?: string } = {};
        try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status === 200 && j.ok) { setSaved((prev) => [...(j.saved || []), ...prev]); resolve({ ok: true }); }
        else resolve({ ok: false, error: j.error || `HTTP ${xhr.status}` });
      };
      xhr.onerror = () => resolve({ ok: false, error: "network error" });
      xhr.send(f); // streams the File body straight through
    });
  }

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

  return (
    <section
      style={{ background: PAPER, color: INK, padding: "34px 20px 60px", borderTop: "1px solid #e5e1dc" }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", marginBottom: 9 }}>
          📤 Share files with the EC2
        </div>
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer?.files?.length) send(e.dataTransfer.files); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
            minHeight: 128, border: `2px dashed ${drag ? ACCENT : "#d8d3cd"}`, borderRadius: 14,
            background: drag ? "#eaf6f8" : "#fffdfb", cursor: "pointer", textAlign: "center", padding: 22,
            transition: "border-color .12s, background .12s",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) send(e.target.files); e.target.value = ""; }}
          />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Drag files here, or click to choose</div>
          <div style={{ fontSize: 11, color: "#98918a", fontFamily: "ui-monospace, Menlo, monospace" }}>
            → /data/scratch/zlabel/data/mappings/uploads/ on the EC2
          </div>
        </label>

        <div style={{ marginTop: 10, fontSize: 12.5, minHeight: 18 }}>
          {busy && <span style={{ color: "#6b655d" }}>{msg}{pct > 0 ? ` ${pct}%` : ""}</span>}
          {!busy && err && <span style={{ color: "#d23b3b", fontWeight: 700 }}>{err}</span>}
          {!busy && !err && msg && <span style={{ color: "#1e9e57", fontWeight: 700 }}>{msg}</span>}
        </div>

        {saved.length > 0 && (
          <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12.5, color: "#6b655d" }}>
            {saved.map((s, i) => (
              <li key={i} style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                {s.filename} <span style={{ color: "#98918a" }}>({human(s.bytes)})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
