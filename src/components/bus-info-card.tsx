import { motion } from "framer-motion";
import { Bus as BusIcon, Phone, Users, Clock } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { Bus } from "@/lib/mock-data";

export function BusInfoCard({ bus, eta }: { bus: Bus; eta: string }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass shadow-elegant pointer-events-auto rounded-3xl p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <BusIcon className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold leading-none">{bus.number}</h2>
              <StatusBadge status={bus.status} />
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {bus.plate} · {bus.speed} km/h
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> ETA
          </div>
          <div className="font-display text-2xl font-bold text-gradient">{eta}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <Phone className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Driver
            </p>
            <p className="truncate text-sm font-semibold">{bus.driver}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <Users className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Occupancy
            </p>
            <p className="text-sm font-semibold">
              {bus.occupied}<span className="text-muted-foreground">/{bus.capacity}</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
