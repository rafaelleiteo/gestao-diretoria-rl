-- Fix RLS Infinite Recursion Bug on profiles and permissoes_usuario

-- 1. Create SECURITY DEFINER function to check admin role safely
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin'
  );
$$;

-- 2. Update RLS policy on public.profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- 3. Update RLS policy on public.permissoes_usuario
DROP POLICY IF EXISTS "Admins can do everything on permissoes_usuario" ON public.permissoes_usuario;
CREATE POLICY "Admins can do everything on permissoes_usuario" ON public.permissoes_usuario
  FOR ALL USING (public.is_admin(auth.uid()));
