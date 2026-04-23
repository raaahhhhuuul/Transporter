import { useEffect, useState } from "react";
import {
  getCachedDriverTracking,
  getLatestDriverTracking,
  subscribeToDriverTracking,
  type LiveTrackingRecord,
} from "@/lib/live-tracking";

export function useLiveTracking(refreshMs = 3000) {
  const [tracking, setTracking] = useState<LiveTrackingRecord | null>(() =>
    getCachedDriverTracking(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const sync = async () => {
      const latest = await getLatestDriverTracking();
      if (!isMounted) return;
      setTracking(latest);
      setLoading(false);
    };

    void sync();

    const unsubscribe = subscribeToDriverTracking((next) => {
      if (!isMounted) return;
      setTracking(next);
      setLoading(false);
    });

    const timer = window.setInterval(() => {
      void sync();
    }, refreshMs);

    return () => {
      isMounted = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  return { tracking, loading };
}
