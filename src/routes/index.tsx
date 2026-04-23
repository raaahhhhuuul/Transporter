import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHomeRouteForRole, getSession } from "../lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;

    const session = getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }

    throw redirect({ to: getHomeRouteForRole(session.role) });
  },
  head: () => ({
    meta: [
      { title: "PulseRide" },
      {
        name: "description",
        content: "Login and continue to your student, driver, or admin portal.",
      },
    ],
  }),
  component: LandingRedirect,
});

function LandingRedirect() {
  return null;
}
