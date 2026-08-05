import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email, role, status, convite_token, criado_em")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw error;

    return profile;
  });

export const listUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) throw error;

    const { data: convites, error: convitesError } = await supabase
      .from("convites")
      .select("*")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false });

    if (convitesError) throw convitesError;

    const pendentes = (convites ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      email: c.email,
      role: "colaborador",
      status: "convidado",
      convite_token: c.token,
      criado_em: c.criado_em,
      isConvite: true,
    }));

    return [
      ...(profiles ?? []).map((p) => ({ ...p, isConvite: false })),
      ...pendentes,
    ];
  });

export const inviteUser = createServerFn({ method: "POST" })
  .inputValidator((data: { nome: string; email: string }) => 
    z.object({ 
      nome: z.string().min(1), 
      email: z.string().email() 
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID();

    const { data: convite, error } = await supabaseAdmin
      .from("convites")
      .insert({
        nome: data.nome,
        email: data.email,
        token,
        status: "pendente",
      })
      .select()
      .single();

    if (error) throw error;
    return { convite, token };
  });

export const deleteInvite = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("convites").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Get the profile to get the email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", id)
      .single();

    if (profile) {
      // Find the user in auth
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const user = users.find(u => u.email === profile.email);
      if (user) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", id);
    
    if (profileError) throw profileError;
    return { ok: true };
  });

export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }) => {
    const { data: convite, error } = await supabase
      .from("convites")
      .select("id, nome, email, status")
      .eq("token", token)
      .eq("status", "pendente")
      .maybeSingle();

    if (error || !convite) return null;
    return convite;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      token: z.string(),
      nome: z.string().min(1),
      password: z.string().min(6)
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Find pending invite
    const { data: convite, error: findError } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", data.token)
      .eq("status", "pendente")
      .maybeSingle();

    if (findError) throw findError;
    if (!convite) throw new Error("Convite inválido ou já utilizado");

    // 2. Create auth user (this generates the auth.users id)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: convite.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome }
    });

    if (createError) throw createError;
    const user = created?.user;
    if (!user) throw new Error("Erro ao criar usuário");

    // 3. Only now create the profile, using the real auth id
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: user.id,
        nome: data.nome,
        email: convite.email,
        role: "colaborador",
        status: "ativo",
        convite_token: null
      });

    if (insertError) throw insertError;

    // 4. Mark invite as used
    const { error: updateError } = await supabaseAdmin
      .from("convites")
      .update({ status: "usado" })
      .eq("id", convite.id);

    if (updateError) throw updateError;

    return { ok: true };
  });

