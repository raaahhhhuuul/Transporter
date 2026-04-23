import { useEffect, useState } from "react";
import { busRoute, lerp, type RoutePoint } from "@/lib/mock-data";

/**
 * Simulates a bus moving along a polyline route by interpolating
 * between consecutive points. Returns the current position and
 * the segment progress (0..1 across all segments).
 */
export function useBusMovement(speed = 0.0018) {
  const [progress, setProgress] = useState(0.18); // overall 0..1
  const [position, setPosition] = useState<RoutePoint>(busRoute[0]);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const next = p + speed * (dt / 16);
        return next >= 1 ? 0.05 : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  useEffect(() => {
    const segments = busRoute.length - 1;
    const scaled = progress * segments;
    const idx = Math.min(Math.floor(scaled), segments - 1);
    const t = scaled - idx;
    const a = busRoute[idx];
    const b = busRoute[idx + 1];
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t);
    setPosition({ x, y });
    setHeading((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  }, [progress]);

  return { position, heading, progress };
}
