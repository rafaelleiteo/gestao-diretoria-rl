-- Apply migration manually since CLI failed
CREATE TABLE IF NOT EXISTS public.rotina_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tab text NOT NULL CHECK (tab IN ('distribuir', 'descarga', 'rotina_padrao', 'semana_1', 'semana_2', 'semana_3', 'semana_4')),
    coluna text NOT NULL,
    area public.inbox_area,
    tipo_linha text NOT NULL CHECK (tipo_linha IN ('card', 'divisor')),
    texto text NOT NULL,
    concluido boolean DEFAULT false,
    ordem integer NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_cards TO authenticated;
GRANT ALL ON public.rotina_cards TO service_role;

ALTER TABLE public.rotina_cards ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rotina_cards' AND policyname = 'Users can manage routine cards') THEN
        CREATE POLICY "Users can manage routine cards" ON public.rotina_cards FOR ALL TO authenticated USING (true);
    END IF;
END $$;
