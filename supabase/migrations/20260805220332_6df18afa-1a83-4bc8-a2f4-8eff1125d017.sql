CREATE TABLE public.permissoes_convite (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  convite_id uuid NOT NULL REFERENCES public.convites(id) ON DELETE CASCADE,
  area text NOT NULL,
  item_menu text NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_convite TO authenticated;
GRANT ALL ON public.permissoes_convite TO service_role;

ALTER TABLE public.permissoes_convite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage invite permissions"
ON public.permissoes_convite FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_permissoes_convite_convite_id ON public.permissoes_convite(convite_id);