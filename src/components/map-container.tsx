import { motion } from "framer-motion";
import { useBusMovement } from "@/hooks/use-bus-movement";
import { busRoute, busStops, studentLocation, buildPath } from "@/lib/mock-data";
import { Bus, Navigation, Plus, Minus, Layers } from "lucide-react";

export function MapContainer() {
  const { position, heading } = useBusMovement();
  const routePath = buildPath(busRoute);

  return (
    <div className="relative h-full w-full overflow-hidden gradient-map-bg">
      {/* Grid backdrop */}
      <div className="absolute inset-0 map-grid opacity-60" />

      {/* Decorative blob "districts" */}
      <div className="absolute left-[-10%] top-[10%] h-[40%] w-[35%] rounded-full bg-success/10 blur-3xl" />
      <div className="absolute right-[-10%] bottom-[20%] h-[35%] w-[40%] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[30%] top-[30%] h-[30%] w-[25%] rounded-full bg-primary/8 blur-3xl" />

      {/* Faux roads */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="route-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.62 0.22 265)" />
            <stop offset="100%" stopColor="oklch(0.72 0.18 200)" />
          </linearGradient>
        </defs>

        {/* Background "roads" - subtle */}
        <g stroke="oklch(0.85 0.01 250)" strokeWidth="0.6" fill="none" strokeLinecap="round">
          <path d="M 0 70 Q 30 60 50 65 T 100 50" />
          <path d="M 10 100 L 30 70 L 60 80 L 90 60 L 100 40" />
          <path d="M 0 30 L 25 35 L 45 25 L 70 30 L 100 15" />
          <path d="M 50 0 L 48 30 L 55 60 L 50 100" />
        </g>

        {/* Route halo */}
        <path
          d={routePath}
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />
        {/* Route main */}
        <path
          d={routePath}
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Animated dashes ahead of bus */}
        <path
          d={routePath}
          fill="none"
          stroke="oklch(1 0 0 / 0.7)"
          strokeWidth="0.5"
          strokeLinecap="round"
          className="route-dash"
        />
      </svg>

      {/* Stops */}
      {busStops.map((s, i) => (
        <div
          key={s.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
        >
          <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-primary bg-background shadow-soft" />
          {(i === 0 || i === busStops.length - 1) && (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-1.5 py-0.5 text-[9px] font-semibold text-background">
              {s.name}
            </div>
          )}
        </div>
      ))}

      {/* Student location */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${studentLocation.x}%`, top: `${studentLocation.y}%` }}
      >
        <div className="relative flex h-5 w-5 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-accent/40 pulse-ring" />
          <div className="relative h-4 w-4 rounded-full border-[3px] border-background bg-accent shadow-elegant" />
        </div>
        <div className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md glass px-2 py-0.5 text-[10px] font-semibold">
          You
        </div>
      </div>

      {/* Bus marker */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        animate={{ left: `${position.x}%`, top: `${position.y}%` }}
        transition={{ type: "tween", ease: "linear", duration: 0.05 }}
      >
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-primary/30 pulse-ring" />
          <motion.div
            animate={{ rotate: heading }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary shadow-glow ring-4 ring-background"
          >
            <Bus className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </motion.div>
          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-soft">
            BUS 42
          </div>
        </div>
      </motion.div>

      {/* Map controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <button className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-secondary" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-px bg-border" />
          <button className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-secondary" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
        </div>
        <button className="glass flex h-10 w-10 items-center justify-center rounded-2xl shadow-card transition-colors hover:bg-secondary" aria-label="Layers">
          <Layers className="h-4 w-4" />
        </button>
        <button className="glass flex h-10 w-10 items-center justify-center rounded-2xl shadow-card transition-colors hover:bg-secondary" aria-label="Recenter">
          <Navigation className="h-4 w-4 text-primary" />
        </button>
      </div>

      {/* Compass / scale */}
      <div className="absolute left-4 bottom-4 glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-card">
        <span className="h-1 w-6 rounded-full bg-foreground/60" />
        500 m
      </div>
    </div>
  );
}
