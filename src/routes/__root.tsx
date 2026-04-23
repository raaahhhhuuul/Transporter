import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { Navbar } from "@/components/navbar";
import { AppToaster } from "@/components/app-toaster";
import { GlobalChennaiMap } from "@/components/global-chennai-map";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This route doesn't exist on the network.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105"
          >
            Back to tracking
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PulseRide — Smart Bus Tracking" },
      { name: "description", content: "Track your campus bus in real time with live ETA, route, and driver info." },
      { name: "author", content: "PulseRide" },
      { property: "og:title", content: "PulseRide — Smart Bus Tracking" },
      { property: "og:description", content: "Track your campus bus in real time with live ETA, route, and driver info." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      {isAuthPage ? (
        <main className="flex-1 bg-background">
          <Outlet />
        </main>
      ) : (
        <div className="flex flex-1 flex-col lg:flex-row">
          <section className="order-1 h-[46vh] min-h-75 border-b border-border/70 lg:order-2 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-l">
            <GlobalChennaiMap className="h-full w-full" />
          </section>
          <main className="order-2 w-full bg-background/85 backdrop-blur-lg lg:order-1 lg:h-[calc(100vh-4rem)] lg:w-115 lg:overflow-y-auto xl:w-130">
            <Outlet />
          </main>
        </div>
      )}
      <AppToaster />
    </div>
  );
}
