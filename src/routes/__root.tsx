import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TopNav } from "@/components/TopNav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold" style={{ color: "#111111" }}>404</h1>
        <h2 className="mt-4 text-xl font-semibold" style={{ color: "#111111" }}>
          Página não encontrada
        </h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#4F46E5" }}
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "#111111" }}>
          Algo deu errado
        </h1>
        <div className="mt-6">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#4F46E5" }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Rafael Leite — Diretoria Geral" },
      { name: "description", content: "Plataforma de gestão pessoal e profissional de Rafael Leite." },
      { property: "og:title", content: "Rafael Leite — Diretoria Geral" },
      { property: "og:description", content: "Plataforma de gestão pessoal e profissional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", backgroundColor: "#FFFFFF", color: "#111111" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
        <TopNav />
        <main style={{ backgroundColor: "#FAFAFA" }} className="min-h-[calc(100vh-57px)]">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
