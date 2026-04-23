import { cn } from "@/lib/utils";

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden gradient-map-bg", className)}>
      <div className="absolute inset-0 map-grid opacity-50" />
      <div className="absolute inset-0 animate-pulse">
        <div className="absolute left-[-10%] top-[10%] h-[40%] w-[35%] rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[20%] h-[35%] w-[40%] rounded-full bg-foreground/5 blur-3xl" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary-foreground/30 border-t-primary-foreground" />
          </div>
          <p className="font-display text-sm font-semibold text-foreground">Loading map…</p>
          <p className="text-xs text-muted-foreground">Locating your bus</p>
        </div>
      </div>
    </div>
  );
}
