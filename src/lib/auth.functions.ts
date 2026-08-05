import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getUnlockStatus } from "./gate.functions";

export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

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
    const token = crypto.randomUUID();
    
    // We use service role to insert profiles without auth.user yet
    // Since we are in a server function, we should ideally use the admin client
    // But for now, let's try the regular client if RLS allows or use admin helper
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        id: crypto.randomUUID(), // Temporary ID until they sign up
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
    // We need to delete from auth.users too, which requires admin privileges
    // This is a placeholder for actual admin deletion logic
    const { error: profileError } = await supabase
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
