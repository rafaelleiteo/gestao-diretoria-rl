import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const verifyAndRegisterOAuthAccess = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        userId: z.string().min(1),
        email: z.string().email(),
        googleName: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const userName = data.googleName || email.split("@")[0];

    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Início do processamento de acesso:");
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN]   - data.userId:", data.userId);
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN]   - data.email:", email);
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN]   - data.googleName:", data.googleName);

    // 1. Check if profile exists by user ID
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Query 1: SELECT * FROM public.profiles WHERE id = data.userId");
    const { data: profileById, error: pIdError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .maybeSingle();

    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado Query 1 (por ID):", {
      profileById,
      error: pIdError ? { message: pIdError.message, code: pIdError.code, details: pIdError.details, hint: pIdError.hint } : null,
    });

    if (profileById) {
      if (profileById.status === "ativo") {
        console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Perfil encontrado por ID com status='ativo'. Acesso liberado.");
        return { success: true, message: "Acesso liberado." };
      } else {
        console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Perfil encontrado por ID porém status != 'ativo' (status:", profileById.status, "). Acesso negado.");
        return {
          success: false,
          error: "Seu e-mail não tem acesso a esta plataforma. Peça um convite ao administrador.",
        };
      }
    }

    // 2. Migration check: profile exists with matching email but old/different ID
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Query 2: SELECT * FROM public.profiles WHERE email ILIKE email");
    const { data: profileByEmail, error: pEmailError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado Query 2 (por Email):", {
      profileByEmail,
      error: pEmailError ? { message: pEmailError.message, code: pEmailError.code, details: pEmailError.details, hint: pEmailError.hint } : null,
    });

    if (profileByEmail) {
      const oldId = profileByEmail.id;
      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Perfil migração encontrado por e-mail! ID antigo:", oldId, "-> Novo ID:", data.userId);

      // Update permissoes_usuario if any
      const { error: permUpdateErr } = await supabaseAdmin
        .from("permissoes_usuario" as any)
        .update({ usuario_id: data.userId } as any)
        .eq("usuario_id", oldId);

      if (permUpdateErr) {
        console.error("[LOG_DIAGNOSTICO] [SERVER_FN] Erro no update de permissoes_usuario:", permUpdateErr);
      }

      // Update profile ID to new auth user ID
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          id: data.userId,
          status: "ativo",
        } as any)
        .eq("id", oldId);

      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado do UPDATE de perfil por e-mail:", { error: updateError });

      if (!updateError) {
        return { success: true, message: "Perfil migrado e acesso liberado." };
      }
    }

    // 3. Pending invite check matching email
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Query 3: SELECT * FROM public.convites WHERE email ILIKE email AND status = 'pendente'");
    const { data: convite, error: conviteError } = await supabaseAdmin
      .from("convites")
      .select("*")
      .ilike("email", email)
      .eq("status", "pendente")
      .maybeSingle();

    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado Query 3 (Convite):", {
      convite,
      error: conviteError ? { message: conviteError.message, code: conviteError.code, details: conviteError.details, hint: conviteError.hint } : null,
    });

    if (convite) {
      const nameToUse = convite.nome || userName;
      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Convite pendente encontrado! Criando perfil em public.profiles...");

      // Create new profile row for invited user
      const { error: createProfileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: data.userId,
          nome: nameToUse,
          email: convite.email,
          role: "colaborador",
          status: "ativo",
          convite_token: null,
        });

      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado INSERT perfil via convite:", { error: createProfileError });

      if (createProfileError) {
        return {
          success: false,
          error: "Erro ao registrar seu acesso. Tente novamente.",
        };
      }

      // Transfer convite permissions to user permissions
      const { data: convitePerms } = await supabaseAdmin
        .from("permissoes_convite" as any)
        .select("area, item_menu")
        .eq("convite_id", convite.id);

      if (convitePerms && convitePerms.length > 0) {
        await supabaseAdmin
          .from("permissoes_usuario" as any)
          .insert(
            (convitePerms as any[]).map((p) => ({
              usuario_id: data.userId,
              area: p.area,
              item_menu: p.item_menu,
            }))
          );

        await supabaseAdmin
          .from("permissoes_convite" as any)
          .delete()
          .eq("convite_id", convite.id);
      }

      // Mark convite as usado
      await supabaseAdmin
        .from("convites")
        .update({ status: "usado" })
        .eq("id", convite.id);

      return { success: true, message: "Convite ativado e acesso liberado." };
    }

    // 4. Special Admin Auto-Provisioning for Owner (rleiteoliveira@gmail.com)
    const isOwner = email === "rleiteoliveira@gmail.com";
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN] 4. Avaliando branch de Auto-Provisionamento:");
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN]   - E-mail é 'rleiteoliveira@gmail.com'?:", isOwner);
    console.log("[LOG_DIAGNOSTICO] [SERVER_FN]   - Entrará no Auto-Provisionamento?:", isOwner ? "SIM" : "NÃO");

    if (isOwner) {
      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Executando INSERT de perfil admin em public.profiles...");
      const { error: createAdminError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: data.userId,
          nome: userName || "Rafael Leite",
          email: email,
          role: "admin",
          status: "ativo",
          convite_token: null,
        });

      console.log("[LOG_DIAGNOSTICO] [SERVER_FN] Resultado INSERT admin profile:", {
        error: createAdminError ? { message: createAdminError.message, code: createAdminError.code, details: createAdminError.details, hint: createAdminError.hint } : null,
      });

      if (!createAdminError) {
        return { success: true, message: "Perfil de administrador criado e acesso liberado." };
      } else {
        console.error("[LOG_DIAGNOSTICO] [SERVER_FN] Falha ao criar perfil de admin:", createAdminError);
      }
    }

    // 5. Unauthorized user
    console.warn("[LOG_DIAGNOSTICO] [SERVER_FN] 5. Nenhuma condição de acesso foi atendida. Retornando Acesso Negado.");
    return {
      success: false,
      error: "Seu e-mail não tem acesso a esta plataforma. Peça um convite ao administrador.",
    };
  });

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, role, status, convite_token, criado_em")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw error;

    return profile;
  });

export const listUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) throw error;

    const { data: convites, error: convitesError } = await supabaseAdmin
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
      convite_token: null,
      criado_em: c.criado_em,
      isConvite: true,
    }));

    return [
      ...(profiles ?? []).map((p) => ({ ...p, isConvite: false })),
      ...pendentes,
    ];
  });

export const inviteUser = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      nome: z.string().min(1),
      email: z.string().email(),
      permissions: z
        .array(z.object({ area: z.string(), item_menu: z.string() }))
        .default([]),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID();

    const { data: convite, error } = await supabaseAdmin
      .from("convites")
      .insert({
        nome: data.nome,
        email: data.email.trim().toLowerCase(),
        token,
        status: "pendente",
      })
      .select()
      .single();

    if (error) throw error;

    if (data.permissions.length > 0) {
      const { error: permError } = await supabaseAdmin
        .from("permissoes_convite" as any)
        .insert(
          data.permissions.map((p) => ({
            convite_id: convite.id,
            area: p.area,
            item_menu: p.item_menu,
          }))
        );
      if (permError) throw permError;
    }

    return { convite };
  });

export const deleteInvite = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("convites").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .validator((id: string) => id)
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
      const user = users.find(u => u.email?.toLowerCase() === profile.email.toLowerCase());
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
