import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TopNav } from "@/components/TopNav";
import { getUnlockStatus } from "@/lib/gate.functions";

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
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/unlock") return;
    const { unlocked } = await getUnlockStatus();
    if (!unlocked) throw redirect({ to: "/unlock" });
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Início — Rafael Leite" },
      { name: "description", content: "Caixa de entrada geral de mensagens, ideias e tarefas." },
      { property: "og:title", content: "Início — Rafael Leite" },
      { property: "og:description", content: "Caixa de entrada geral de mensagens, ideias e tarefas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Início — Rafael Leite" },
      { name: "twitter:description", content: "Caixa de entrada geral de mensagens, ideias e tarefas." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/02707b65-28f8-4a77-9441-cd751efc4892/id-preview-1f3d555e--8f5ad2c0-a2aa-4957-9451-ffeb003c5446.lovable.app-1784841159736.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/02707b65-28f8-4a77-9441-cd751efc4892/id-preview-1f3d555e--8f5ad2c0-a2aa-4957-9451-ffeb003c5446.lovable.app-1784841159736.png" },
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
        <Toaster />
        <Scripts />

      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isUnlock = pathname === "/unlock";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
        {!isUnlock && <TopNav />}
        <main
          style={{ backgroundColor: "#FAFAFA" }}
          className={isUnlock ? "min-h-screen" : "min-h-[calc(100vh-57px)]"}
        >
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
