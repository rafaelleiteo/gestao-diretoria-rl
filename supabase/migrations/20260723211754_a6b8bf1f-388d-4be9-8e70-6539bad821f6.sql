
ALTER TYPE public.inbox_area ADD VALUE IF NOT EXISTS 'gestao';

CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read prompts" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "Public can insert prompts" ON public.prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update prompts" ON public.prompts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete prompts" ON public.prompts FOR DELETE USING (true);
