// Small line glyphs, one per side of the task. Stroke-only and currentColor so each inherits the
// colour its section already carries; decorative, so hidden from screen readers — the label beside
// each one is the accessible name.
export function IconInput({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5h9M3 10h9M3 14.5h6" />
      <path d="M14.5 8.5 17.5 11.5 14.5 14.5" />
    </svg>
  );
}

export function IconOutput({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.6 16.6 6v8L10 17.4 3.4 14V6z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

export function IconScore({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3.4v13.2M4.4 6.2h11.2" />
      <path d="M4.4 6.2 2.2 11.2h4.4zM15.6 6.2 13.4 11.2h4.4" />
      <path d="M7.4 16.6h5.2" />
    </svg>
  );
}

export function IconDocs({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 4.4A1.2 1.2 0 0 1 4.4 3.2H9a1.6 1.6 0 0 1 1 .4V16a1.6 1.6 0 0 0-1-.4H4.4a1.2 1.2 0 0 1-1.2-1.2z" />
      <path d="M16.8 4.4a1.2 1.2 0 0 0-1.2-1.2H11a1.6 1.6 0 0 0-1 .4V16a1.6 1.6 0 0 1 1-.4h4.6a1.2 1.2 0 0 0 1.2-1.2z" />
    </svg>
  );
}
