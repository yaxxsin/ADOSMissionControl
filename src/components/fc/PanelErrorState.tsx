import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PanelErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-4 flex flex-col items-center gap-3 text-status-error">
      <AlertTriangle size={24} />
      <p className="text-sm text-center">{error}</p>
      <Button size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}
