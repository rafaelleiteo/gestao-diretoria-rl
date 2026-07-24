
CREATE TABLE public.tarefas_recorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area public.inbox_area NOT NULL,
  titulo text NOT NULL,
  tipo_recorrencia text NOT NULL CHECK (tipo_recorrencia IN ('dia_mes','dia_semana','intervalo_meses')),
  dia_mes integer CHECK (dia_mes IS NULL OR (dia_mes BETWEEN 1 AND 31)),
  dia_semana text CHECK (dia_semana IS NULL OR dia_semana IN ('seg','ter','qua','qui','sex','sab','dom')),
  data_inicio date,
  intervalo_meses integer CHECK (intervalo_meses IS NULL OR intervalo_meses >= 1),
  ultima_conclusao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_recorrentes TO anon, authenticated;
GRANT ALL ON public.tarefas_recorrentes TO service_role;

ALTER TABLE public.tarefas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read tarefas recorrentes" ON public.tarefas_recorrentes FOR SELECT USING (true);
CREATE POLICY "Public can insert tarefas recorrentes" ON public.tarefas_recorrentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update tarefas recorrentes" ON public.tarefas_recorrentes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete tarefas recorrentes" ON public.tarefas_recorrentes FOR DELETE USING (true);
