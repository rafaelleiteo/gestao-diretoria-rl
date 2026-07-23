
CREATE TYPE public.inbox_tipo AS ENUM ('mensagem', 'ideia', 'tarefa');
CREATE TYPE public.inbox_area AS ENUM (
  'geral','diretoria','financeiro','consultorio','versa3d',
  'especializacao','graduacao','doutorado','dentistas-petropolis','connect-lab'
);

CREATE TABLE public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL,
  tipo public.inbox_tipo NOT NULL,
  area public.inbox_area NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO anon, authenticated;
GRANT ALL ON public.inbox_items TO service_role;

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read inbox items"
  ON public.inbox_items FOR SELECT
  USING (true);

CREATE POLICY "Public can insert inbox items"
  ON public.inbox_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update inbox items"
  ON public.inbox_items FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete inbox items"
  ON public.inbox_items FOR DELETE
  USING (true);

CREATE INDEX inbox_items_area_idx ON public.inbox_items(area);
CREATE INDEX inbox_items_criado_em_idx ON public.inbox_items(criado_em DESC);
