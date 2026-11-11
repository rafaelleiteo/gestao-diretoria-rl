-- Migration: 20260927000000_create_financeiro_lancamentos.sql

-- 1. Table: financeiro_areas
CREATE TABLE IF NOT EXISTS public.financeiro_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Populate initial 6 records (ordem 1 a 6)
INSERT INTO public.financeiro_areas (nome, ordem, ativo)
VALUES 
  ('Pessoal', 1, true),
  ('Consultório', 2, true),
  ('Versa3D', 3, true),
  ('LabConect', 4, true),
  ('Dental Mind', 5, true),
  ('Especialização', 6, true)
ON CONFLICT (nome) DO NOTHING;

-- 2. Table: fornecedores_conhecidos
CREATE TABLE IF NOT EXISTS public.fornecedores_conhecidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao_nome TEXT NOT NULL,
  categoria TEXT,
  area TEXT REFERENCES public.financeiro_areas(nome) ON UPDATE CASCADE ON DELETE SET NULL,
  responsavel TEXT,
  fixo_variavel TEXT CHECK (fixo_variavel IN ('fixo', 'variavel', 'a_definir', 'indiferente')),
  carne_leao TEXT CHECK (carne_leao IN ('sim', 'nao', 'indiferente', 'a_definir')),
  divide TEXT,
  observacao_padrao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: financeiro_lancamentos
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  competencia TEXT NOT NULL CHECK (competencia ~ '^\d{2}/\d{4}$'),
  empresa TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  area TEXT REFERENCES public.financeiro_areas(nome) ON UPDATE CASCADE ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  forma_pagamento TEXT,
  responsavel TEXT,
  fixo_variavel TEXT CHECK (fixo_variavel IN ('fixo', 'variavel', 'a_definir', 'indiferente')),
  carne_leao TEXT CHECK (carne_leao IN ('sim', 'nao', 'indiferente', 'a_definir')),
  observacao TEXT,
  divide TEXT,
  parcelas_totais INTEGER NOT NULL DEFAULT 1,
  parcela_atual INTEGER NOT NULL DEFAULT 1,
  valor_total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'validado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  validado_em TIMESTAMPTZ
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.financeiro_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_conhecidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage financeiro_areas" ON public.financeiro_areas;
DROP POLICY IF EXISTS "Admins can manage fornecedores_conhecidos" ON public.fornecedores_conhecidos;
DROP POLICY IF EXISTS "Admins can manage financeiro_lancamentos" ON public.financeiro_lancamentos;

-- 6. Create RLS policies restricting access EXCLUSIVELY to admin users
CREATE POLICY "Admins can manage financeiro_areas"
ON public.financeiro_areas
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage fornecedores_conhecidos"
ON public.fornecedores_conhecidos
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage financeiro_lancamentos"
ON public.financeiro_lancamentos
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
