CREATE TABLE public.protocolos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('clinico', 'gestao')),
    titulo TEXT NOT NULL,
    descricao TEXT,
    conteudo TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolos TO authenticated;
GRANT ALL ON public.protocolos TO service_role;

ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own protocols"
    ON public.protocolos
    FOR ALL
    TO authenticated
    USING (true);
