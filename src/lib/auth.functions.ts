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
    return profiles;
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
    
    // We use a random UUID for ID for now, as we don't have an auth.user yet.
    // However, Supabase profiles table usually requires a valid UUID.
    // The instructions say "vincular ao perfil existente (mesmo id)" during signup.
    // This means we'll create the profile with a random ID, then when they sign up,
    // we'll have a problem if we want them to have the SAME ID.
    // Actually, we can create the profile and then update it, or better:
    // Create the profile with a random ID, and during signup, update the profile ID or create a new one and delete the old.
    // Or simpler: create the profile and use the token to find it.
    
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: crypto.randomUUID(), 
        nome: data.nome,
        email: data.email,
        role: "colaborador",
        status: "convidado",
        convite_token: token
      })
      .select()
      .single();

    if (error) throw error;
    return { profile, token };
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
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("convite_token", token)
      .eq("status", "convidado")
      .single();

    if (error || !profile) return null;
    return profile;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((data: any) => 
    z.object({
      token: z.string(),
      nome: z.string().min(1),
      password: z.string().min(6)
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Find profile
    const { data: profile, error: findError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("convite_token", data.token)
      .eq("status", "convidado")
      .single();

    if (findError || !profile) throw new Error("Convite inválido");

    // 2. Create auth user
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome }
    });

    if (createError) throw createError;
    if (!user) throw new Error("Erro ao criar usuário");

    // 3. Update profile: assign real ID, change status, update name, clear token
    // Since ID is primary key and we can't easily change it if there are foreign keys (none yet),
    // we'll delete the old one and create a new one with the correct ID.
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", profile.id);
    
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: user.id,
        nome: data.nome,
        email: profile.email,
        role: "colaborador",
        status: "ativo",
        convite_token: null
      });

    if (insertError) throw insertError;

    return { ok: true };
  });
