/**
 * Map loading skeleton — same height as MapContainer to prevent CLS.
 * AGENTS.md / REVERSE_ENGINEERING_DOC.md Pattern 11: MapSkeleton must match map height.
 */
export default function MapSkeleton() {
  return (
    <div className="w-full h-[400px] rounded-2xl bg-surface-900 border border-surface-800 overflow-hidden relative">
      <div className="absolute inset-0 skeleton" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-surface-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
          </svg>
          <span className="text-sm text-surface-500">Loading map…</span>
        </div>
      </div>
    </div>
  );
}
