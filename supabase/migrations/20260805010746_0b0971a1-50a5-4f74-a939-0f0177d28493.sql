CREATE TABLE public.links_rapidos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    area text NOT NULL,
    titulo text NOT NULL,
    url text NOT NULL,
    criado_em timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_rapidos TO authenticated;
GRANT ALL ON public.links_rapidos TO service_role;

ALTER TABLE public.links_rapidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see all links" ON public.links_rapidos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert links" ON public.links_rapidos
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete their own links" ON public.links_rapidos
    FOR DELETE TO authenticated USING (true);

-- Insert new recurring payments
INSERT INTO public.pagamentos_recorrentes (dia_mes, descricao) VALUES
(5, 'Iolanda primeira segunda'),
(10, 'Plano de saúde geral'),
(15, 'Recarga consultório'),
(15, 'Recarga esp.'),
(15, 'Recarga Isabele'),
(15, 'Contador'),
(15, 'ABO'),
(18, 'INSS'),
(18, 'FGTS'),
(20, 'DAS'),
(30, 'ISS');