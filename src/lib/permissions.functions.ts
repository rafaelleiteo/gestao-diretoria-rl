import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getPermissions = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { data, error } = await supabase
      .from("permissoes_usuario" as any)
      .select("*")
      .eq("usuario_id", userId);
    
    if (error) throw error;
    return data as any[];
  });

export const savePermissions = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string, permissions: { area: string, item_menu: string }[] }) => 
    z.object({
      userId: z.string(),
      permissions: z.array(z.object({
        area: z.string(),
        item_menu: z.string()
      }))
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Delete existing permissions for this user
    const { error: deleteError } = await supabaseAdmin
      .from("permissoes_usuario" as any)
      .delete()
      .eq("usuario_id", data.userId);
    
    if (deleteError) throw deleteError;

    // 2. Insert new permissions if any
    if (data.permissions.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("permissoes_usuario" as any)
        .insert(data.permissions.map(p => ({
          usuario_id: data.userId,
          area: p.area,
          item_menu: p.item_menu
        })));
      
      if (insertError) throw insertError;
    }

    return { ok: true };
  });

export const checkPermission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { area: string, item_menu: string }) => 
    z.object({
      area: z.string(),
      item_menu: z.string()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    // Get user profile role
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    
    if (!profile) return false;
    if (profile.role === "admin") return true;

    // Check specific permission or wildcards
    const { data: perm, error: permissionError } = await context.supabase
      .from("permissoes_usuario" as any)
      .select("id")
      .eq("usuario_id", context.userId)
      .eq("area", data.area)
      .or(`item_menu.eq.${data.item_menu},item_menu.eq.*`)
      .limit(1);

    if (permissionError) throw permissionError;

    return !!(perm as any)?.length;
  });

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("permissoes_usuario" as any)
      .select("area, item_menu")
      .eq("usuario_id", context.userId);
    
    if (error) throw error;
    return data as any[];
  });
