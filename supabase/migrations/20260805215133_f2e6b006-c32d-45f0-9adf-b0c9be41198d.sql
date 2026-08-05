CREATE TABLE public.convites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.convites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invites by token" ON public.convites FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert invites" ON public.convites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update invites" ON public.convites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete invites" ON public.convites FOR DELETE TO authenticated USING (true);