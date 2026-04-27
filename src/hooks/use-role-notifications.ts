import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type AppRoleForNotifications = "student" | "driver";

export interface RoleNotification {
  id: string;
  title: string;
  message: string;
  targetRole: "all" | AppRoleForNotifications;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  target_role: "all" | AppRoleForNotifications;
  created_at: string;
}

export function useRoleNotifications(role: AppRoleForNotifications, refreshMs = 10000) {
  const [notifications, setNotifications] = useState<RoleNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("id, title, message, target_role, created_at")
        .in("target_role", ["all", role])
        .order("created_at", { ascending: false })
        .limit(8);

      if (!isMounted) return;

      if (error) {
        setLoading(false);
        return;
      }

      const mapped = ((data ?? []) as NotificationRow[]).map(
        (item) =>
          ({
            id: item.id,
            title: item.title,
            message: item.message,
            targetRole: item.target_role,
            createdAt: item.created_at,
          }) satisfies RoleNotification,
      );

      setNotifications(mapped);
      setLoading(false);
    };

    void load();

    const timer = window.setInterval(() => {
      void load();
    }, refreshMs);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [refreshMs, role]);

  return { notifications, loading };
}
