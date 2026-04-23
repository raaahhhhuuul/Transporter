import { motion } from "framer-motion";
import { MapPin, ChevronUp, Navigation2 } from "lucide-react";
import { busStops } from "@/lib/mock-data";

export function NextStopPanel({
  distance,
  minutes,
}: {
  distance: string;
  minutes: number;
}) {
  // pick the next "upcoming" stop for demo (3rd one)
  const upcoming = busStops.slice(2, 6);
  const next = upcoming[0];

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      className="glass shadow-elegant pointer-events-auto rounded-3xl"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2.5">
        <div className="h-1 w-10 rounded-full bg-foreground/15" />
      </div>

      {/* Next stop hero */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" strokeWidth={2.5} />
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next Stop
              </p>
              <h3 className="font-display text-lg font-bold leading-tight">{next.name}</h3>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-foreground">{minutes}<span className="text-base font-semibold text-muted-foreground"> min</span></div>
            <p className="text-xs font-medium text-muted-foreground">{distance} away</p>
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-success/10 px-3.5 py-2.5 text-success">
          <div className="flex items-center gap-2">
            <Navigation2 className="h-4 w-4 float-y" strokeWidth={2.5} />
            <span className="text-sm font-semibold">Arriving in {minutes} mins</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider">On Time</span>
        </div>
      </div>

      {/* Upcoming stops timeline */}
      <div className="border-t border-border/50 px-5 pb-4 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Upcoming
          </p>
          <button className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            View all <ChevronUp className="h-3 w-3 rotate-180" />
          </button>
        </div>
        <ol className="relative space-y-2.5 pl-4">
          <span className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
          {upcoming.slice(1).map((s) => (
            <li key={s.id} className="relative flex items-center justify-between">
              <span className="absolute -left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-border bg-background" />
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-xs font-semibold text-muted-foreground">{s.eta}</span>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}
