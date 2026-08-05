import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getInviteByToken, acceptInvite } from "@/lib/auth.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Aceitar Convite — Rafael Leite" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const router = useRouter();
  const getInvite = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvite({ data: token });
        if (data) {
          setProfile(data);
          setNome(data.nome);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, getInvite]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSubmitting(true);
    try {
      await accept({
        data: {
          token,
          nome,
          password
        }
      });
      toast.success("Conta criada com sucesso!");
      router.navigate({ to: "/unlock" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar convite");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="text-sm text-[#6B7280]">Carregando...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "#EDEDED" }}>
          <h1 className="text-xl font-bold text-[#111111]">Convite inválido</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Este convite expirou ou já foi utilizado.</p>
          <button
            onClick={() => router.navigate({ to: "/unlock" })}
            className="mt-6 rounded-full px-6 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#4F46E5" }}
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border bg-white p-8"
        style={{ borderColor: "#EDEDED" }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Finalizar cadastro</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">Defina seu nome e senha para acessar a plataforma.</p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#6B7280]">E-mail</span>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] text-[#6B7280] outline-none"
              style={{ borderColor: "#EDEDED" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#6B7280]">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#6B7280]">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[#6B7280]">Confirmar Senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-10 rounded-full border bg-[#FAFAFA] px-4 text-[14px] outline-none focus:border-[#4F46E5]"
              style={{ borderColor: "#EDEDED" }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 h-10 rounded-full text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#4F46E5" }}
          >
            {submitting ? "Salvando..." : "Criar conta"}
          </button>
        </div>
      </form>
    </div>
  );
}
