-- ==========================================
-- INCREMENTO: TAREFAS RECORRENTES MENSAL
-- ==========================================

-- 1. TABELAS
CREATE TABLE IF NOT EXISTS public.tarefas_recorrentes_mensal_item (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dia_mes int NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
    descricao text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tarefas_recorrentes_mensal_registro (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.tarefas_recorrentes_mensal_item(id) ON DELETE CASCADE,
    mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano int NOT NULL,
    feito boolean NOT NULL DEFAULT false,
    UNIQUE (item_id, mes, ano)
);

-- 2. SEGURANÇA & PERMISSÕES (RLS & GRANTS)

-- tarefas_recorrentes_mensal_item
ALTER TABLE public.tarefas_recorrentes_mensal_item ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_recorrentes_mensal_item TO anon, authenticated;
GRANT ALL ON public.tarefas_recorrentes_mensal_item TO service_role;
CREATE POLICY "Public can read tarefas_recorrentes_mensal_item" ON public.tarefas_recorrentes_mensal_item FOR SELECT USING (true);
CREATE POLICY "Public can insert tarefas_recorrentes_mensal_item" ON public.tarefas_recorrentes_mensal_item FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update tarefas_recorrentes_mensal_item" ON public.tarefas_recorrentes_mensal_item FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete tarefas_recorrentes_mensal_item" ON public.tarefas_recorrentes_mensal_item FOR DELETE USING (true);

-- tarefas_recorrentes_mensal_registro
ALTER TABLE public.tarefas_recorrentes_mensal_registro ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_recorrentes_mensal_registro TO anon, authenticated;
GRANT ALL ON public.tarefas_recorrentes_mensal_registro TO service_role;
CREATE POLICY "Public can read tarefas_recorrentes_mensal_registro" ON public.tarefas_recorrentes_mensal_registro FOR SELECT USING (true);
CREATE POLICY "Public can insert tarefas_recorrentes_mensal_registro" ON public.tarefas_recorrentes_mensal_registro FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update tarefas_recorrentes_mensal_registro" ON public.tarefas_recorrentes_mensal_registro FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete tarefas_recorrentes_mensal_registro" ON public.tarefas_recorrentes_mensal_registro FOR DELETE USING (true);
