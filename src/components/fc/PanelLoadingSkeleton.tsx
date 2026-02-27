export function PanelLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-bg-tertiary/50 rounded animate-pulse" />
      ))}
    </div>
  );
}
