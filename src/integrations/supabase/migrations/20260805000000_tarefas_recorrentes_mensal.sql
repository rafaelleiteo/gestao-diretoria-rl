-- Create tarefas_recorrentes_mensal_item
CREATE TABLE public.tarefas_recorrentes_mensal_item (
    id uuid primary key default gen_random_uuid(),
    dia_mes int not null check (dia_mes >= 1 AND dia_mes <= 31),
    descricao text not null
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_recorrentes_mensal_item TO authenticated;
GRANT ALL ON public.tarefas_recorrentes_mensal_item TO service_role;
ALTER TABLE public.tarefas_recorrentes_mensal_item ENABLE ROW LEVEL SECURITY;

-- Create tarefas_recorrentes_mensal_registro
CREATE TABLE public.tarefas_recorrentes_mensal_registro (
    id uuid primary key default gen_random_uuid(),
    item_id uuid references public.tarefas_recorrentes_mensal_item(id) on delete cascade not null,
    mes int not null,
    ano int not null,
    feito boolean default false,
    UNIQUE(item_id, mes, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_recorrentes_mensal_registro TO authenticated;
GRANT ALL ON public.tarefas_recorrentes_mensal_registro TO service_role;
ALTER TABLE public.tarefas_recorrentes_mensal_registro ENABLE ROW LEVEL SECURITY;

-- Seed items
INSERT INTO public.tarefas_recorrentes_mensal_item (dia_mes, descricao) VALUES
(1, 'Mandar email Taina sobre atendimentos'),
(1, 'Fechar contas aulas Professores'),
(5, 'Cobrança clientes VERSA'),
(25, 'Fechar agenda mês seguinte'),
(25, 'Fechar Pagamento Belle');
