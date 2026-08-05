-- Create table for routine cards
CREATE TABLE public.rotina_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tab text NOT NULL CHECK (tab IN ('distribuir', 'descarga', 'rotina_padrao', 'semana_1', 'semana_2', 'semana_3', 'semana_4')),
    coluna text NOT NULL,
    area public.inbox_area, -- Reuse the existing enum
    tipo_linha text NOT NULL CHECK (tipo_linha IN ('card', 'divisor')),
    texto text NOT NULL,
    concluido boolean DEFAULT false,
    ordem integer NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_cards TO authenticated;
GRANT ALL ON public.rotina_cards TO service_role;

-- Enable RLS
ALTER TABLE public.rotina_cards ENABLE ROW LEVEL SECURITY;

-- Simple policy for authenticated users
CREATE POLICY "Users can manage routine cards" ON public.rotina_cards
    FOR ALL TO authenticated USING (true);
