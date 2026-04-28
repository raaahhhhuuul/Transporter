import { useEffect, useState } from "react";

export type AppRoleForNotifications = "student" | "driver";

export interface RoleNotification {
  id: string;
  title: string;
  message: string;
  targetRole: "all" | AppRoleForNotifications;
  createdAt: string;
}

export function useRoleNotifications(role: AppRoleForNotifications, refreshMs = 10000) {
  const [notifications, setNotifications] = useState<RoleNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotifications([]);
    setLoading(false);
  }, [refreshMs, role]);

  return { notifications, loading };
}
