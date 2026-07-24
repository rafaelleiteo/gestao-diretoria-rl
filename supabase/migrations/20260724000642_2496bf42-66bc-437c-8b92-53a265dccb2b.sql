
CREATE TABLE public.pagamentos_recorrentes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_mes int NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
  descricao text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_recorrentes TO anon, authenticated;
GRANT ALL ON public.pagamentos_recorrentes TO service_role;

ALTER TABLE public.pagamentos_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pagamentos_recorrentes" ON public.pagamentos_recorrentes FOR SELECT USING (true);
CREATE POLICY "Public can insert pagamentos_recorrentes" ON public.pagamentos_recorrentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update pagamentos_recorrentes" ON public.pagamentos_recorrentes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete pagamentos_recorrentes" ON public.pagamentos_recorrentes FOR DELETE USING (true);

CREATE TABLE public.pagamentos_recorrentes_registro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos_recorrentes(id) ON DELETE CASCADE,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL,
  impresso boolean NOT NULL DEFAULT false,
  pago boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagamento_id, mes, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_recorrentes_registro TO anon, authenticated;
GRANT ALL ON public.pagamentos_recorrentes_registro TO service_role;

ALTER TABLE public.pagamentos_recorrentes_registro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pagamentos_recorrentes_registro" ON public.pagamentos_recorrentes_registro FOR SELECT USING (true);
CREATE POLICY "Public can insert pagamentos_recorrentes_registro" ON public.pagamentos_recorrentes_registro FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update pagamentos_recorrentes_registro" ON public.pagamentos_recorrentes_registro FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete pagamentos_recorrentes_registro" ON public.pagamentos_recorrentes_registro FOR DELETE USING (true);

CREATE INDEX idx_pagrec_reg_pagamento ON public.pagamentos_recorrentes_registro(pagamento_id, ano, mes);

INSERT INTO public.pagamentos_recorrentes (dia_mes, descricao) VALUES
  (1, 'Pagamento Isabele'),
  (1, 'Estacionamento'),
  (1, 'Vale transporte Joyce'),
  (1, 'Aluguel do carro'),
  (5, 'Aluguel consultório'),
  (5, 'Transferência consultório'),
  (5, 'Aluguel casa'),
  (5, 'Salário Joyce'),
  (6, 'Cartão de crédito Azul'),
  (6, 'Cartão de crédito Santander'),
  (6, 'Cartão de crédito Inter'),
  (6, 'Cartão de crédito Nubank'),
  (10, 'Plano de saúde individual'),
  (15, 'Recarga Versa');
