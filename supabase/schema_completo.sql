-- Create table for routine cards
CREATE TABLE public.rotina_cards (
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

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_cards TO authenticated;
GRANT ALL ON public.rotina_cards TO service_role;

-- Enable RLS
ALTER TABLE public.rotina_cards ENABLE ROW LEVEL SECURITY;

-- Simple policy for authenticated users
CREATE POLICY "Users can manage routine cards" ON public.rotina_cards
    FOR ALL TO authenticated USING (true);
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

CREATE TYPE public.inbox_tipo AS ENUM ('mensagem', 'ideia', 'tarefa');
CREATE TYPE public.inbox_area AS ENUM (
  'geral','diretoria','financeiro','consultorio','versa3d',
  'especializacao','graduacao','doutorado','dentistas-petropolis','connect-lab'
);

CREATE TABLE public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL,
  tipo public.inbox_tipo NOT NULL,
  area public.inbox_area NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO anon, authenticated;
GRANT ALL ON public.inbox_items TO service_role;

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read inbox items"
  ON public.inbox_items FOR SELECT
  USING (true);

CREATE POLICY "Public can insert inbox items"
  ON public.inbox_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update inbox items"
  ON public.inbox_items FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete inbox items"
  ON public.inbox_items FOR DELETE
  USING (true);

CREATE INDEX inbox_items_area_idx ON public.inbox_items(area);
CREATE INDEX inbox_items_criado_em_idx ON public.inbox_items(criado_em DESC);

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
ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS lembrete_data_hora TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_enviado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inbox_items_lembrete_pendente
  ON public.inbox_items (lembrete_data_hora)
  WHERE lembrete_enviado = false AND lembrete_data_hora IS NOT NULL;CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'send-reminders-every-5min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'send-reminders-every-5min',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://gestao-diretoria-rl.lovable.app/api/public/hooks/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
ALTER TABLE public.inbox_items ADD COLUMN IF NOT EXISTS prioridades text[];
UPDATE public.inbox_items SET prioridades = ARRAY['indiferente']::text[] WHERE prioridades IS NULL;
ALTER TABLE public.inbox_items ALTER COLUMN prioridades SET NOT NULL;
ALTER TABLE public.inbox_items ALTER COLUMN prioridades SET DEFAULT ARRAY['indiferente']::text[];

ALTER TABLE public.inbox_items ADD CONSTRAINT inbox_prioridades_valid
  CHECK (
    prioridades <@ ARRAY['urgente','importante','hoje','longo_prazo','indiferente']::text[]
    AND array_length(prioridades, 1) >= 1
  );

ALTER TABLE public.inbox_items ADD COLUMN IF NOT EXISTS dia_semana text;
ALTER TABLE public.inbox_items ADD CONSTRAINT inbox_dia_semana_valid
  CHECK (dia_semana IS NULL OR dia_semana IN ('seg','ter','qua','qui','sex','sab','dom'));

ALTER TABLE public.inbox_items ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

CREATE OR REPLACE FUNCTION public.inbox_items_set_concluido_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.concluido IS DISTINCT FROM OLD.concluido THEN
    IF NEW.concluido THEN
      NEW.concluido_em = now();
    ELSE
      NEW.concluido_em = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_items_concluido_em ON public.inbox_items;
CREATE TRIGGER trg_inbox_items_concluido_em
BEFORE UPDATE ON public.inbox_items
FOR EACH ROW EXECUTE FUNCTION public.inbox_items_set_concluido_em();

CREATE OR REPLACE FUNCTION public.inbox_items_set_concluido_em_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.concluido AND NEW.concluido_em IS NULL THEN
    NEW.concluido_em = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_items_concluido_em_ins ON public.inbox_items;
CREATE TRIGGER trg_inbox_items_concluido_em_ins
BEFORE INSERT ON public.inbox_items
FOR EACH ROW EXECUTE FUNCTION public.inbox_items_set_concluido_em_insert();

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

CREATE TABLE public.documento_modelos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('encaminhamento','atestado','declaracao','receituario')),
  nome text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_modelos TO anon, authenticated;
GRANT ALL ON public.documento_modelos TO service_role;

ALTER TABLE public.documento_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read documento_modelos" ON public.documento_modelos FOR SELECT USING (true);
CREATE POLICY "Public can insert documento_modelos" ON public.documento_modelos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update documento_modelos" ON public.documento_modelos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete documento_modelos" ON public.documento_modelos FOR DELETE USING (true);

INSERT INTO public.documento_modelos (tipo, nome, conteudo, ordem) VALUES
('encaminhamento','Avaliação Periodontal','Encaminho o(a) {{paciente}} solicitando avaliação periodontal e o tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',1),
('encaminhamento','Exodontia','Encaminho o(a) {{paciente}} solicitando avaliação para exodontia do(s) {{dente_singular_plural}}: {{campo_dentes}}. Agradeço antecipadamente pela atenção dedicada ao paciente.',2),
('encaminhamento','Endodontia','Encaminho o(a) {{paciente}} solicitando avaliação endodôntica do(s) {{dente_singular_plural}}: {{campo_dentes}} e o tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',3),
('encaminhamento','Avaliação Geral','Encaminho o(a) {{paciente}} para avaliação geral da saúde bucal. Solicito que seja realizada profilaxia, avaliação da presença de tecido cariado nas arcadas superior e inferior, avaliação periodontal e análise das condições das restaurações. Agradeço antecipadamente pela atenção dedicada ao paciente.',4),
('encaminhamento','Implante','Encaminho o(a) {{paciente}} para avaliação e possível instalação de implantes na região do(s) {{dente_singular_plural}}: {{campo_dentes}}, bem como para planejamento da reabilitação protética. Agradeço antecipadamente pela atenção dedicada ao paciente.',5),
('encaminhamento','Ortodontia','Encaminho o(a) {{paciente}} para avaliação ortodôntica e planejamento do tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',6),
('atestado','Atestado Odontológico','Regulamentado pelas Leis nº 5.081, de 24/08/1966, e nº 6.215, de 30/06/1975. Atesto, para fins {{finalidade}}, a pedido, que {{paciente}} esteve sob tratamento odontológico neste consultório, no período das {{hora_inicio}} às {{hora_fim}} horas, no dia {{data}}{{repouso}}.',7),
('declaracao','Declaração de Comparecimento','Declaro que o(a) paciente {{paciente}} compareceu a esta clínica odontológica no dia {{data}}, no horário das {{hora_inicio}} às {{hora_fim}} horas, para realização de tratamento odontológico.',8),
('receituario','Receituário','',9);

CREATE TABLE public.configuracao_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url text,
  cabecalho_texto text,
  rodape_texto text,
  mostrar_timbre boolean NOT NULL DEFAULT true,
  usar_papel_timbrado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracao_documentos TO anon, authenticated;
GRANT ALL ON public.configuracao_documentos TO service_role;

ALTER TABLE public.configuracao_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read configuracao_documentos" ON public.configuracao_documentos FOR SELECT USING (true);
CREATE POLICY "Public can insert configuracao_documentos" ON public.configuracao_documentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update configuracao_documentos" ON public.configuracao_documentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete configuracao_documentos" ON public.configuracao_documentos FOR DELETE USING (true);

INSERT INTO public.configuracao_documentos (mostrar_timbre, usar_papel_timbrado) VALUES (true, false);

-- Storage policies for the documento-timbre bucket
CREATE POLICY "Public read documento-timbre" ON storage.objects FOR SELECT USING (bucket_id = 'documento-timbre');
CREATE POLICY "Public insert documento-timbre" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documento-timbre');
CREATE POLICY "Public update documento-timbre" ON storage.objects FOR UPDATE USING (bucket_id = 'documento-timbre') WITH CHECK (bucket_id = 'documento-timbre');
CREATE POLICY "Public delete documento-timbre" ON storage.objects FOR DELETE USING (bucket_id = 'documento-timbre');
ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS aguardando_feedback boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.inbox_items_set_concluido_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.concluido IS DISTINCT FROM OLD.concluido THEN
    IF NEW.concluido THEN
      NEW.concluido_em = now();
      NEW.aguardando_feedback = false;
    ELSE
      NEW.concluido_em = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inbox_items_set_concluido_em_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.concluido THEN
    IF NEW.concluido_em IS NULL THEN
      NEW.concluido_em = now();
    END IF;
    NEW.aguardando_feedback = false;
  END IF;
  RETURN NEW;
END;
$function$;-- Apply migration manually since CLI failed
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
(30, 'ISS');CREATE TABLE public.links_rapidos (
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
-- 1. Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'colaborador')),
    status TEXT NOT NULL CHECK (status IN ('convidado', 'ativo')),
    convite_token TEXT UNIQUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;

-- 4. Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
create table if not exists public.permissoes_usuario (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid references public.profiles(id) on delete cascade not null,
    area text not null,
    item_menu text not null,
    criado_em timestamptz default now(),
    unique (usuario_id, area, item_menu)
);

grant select, insert, update, delete on public.permissoes_usuario to authenticated;
grant all on public.permissoes_usuario to service_role;

alter table public.permissoes_usuario enable row level security;

-- We'll use a direct role check in the policy since has_role is failing or needs to be defined
create policy "Admins can do everything on permissoes_usuario"
on public.permissoes_usuario
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Users can view their own permissions"
on public.permissoes_usuario
for select
to authenticated
using (usuario_id = auth.uid());
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.permissoes_usuario TO authenticated;
GRANT ALL ON public.permissoes_usuario TO service_role;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;CREATE TABLE public.convites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.convites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invites by token" ON public.convites FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert invites" ON public.convites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update invites" ON public.convites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete invites" ON public.convites FOR DELETE TO authenticated USING (true);CREATE TABLE public.permissoes_convite (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  convite_id uuid NOT NULL REFERENCES public.convites(id) ON DELETE CASCADE,
  area text NOT NULL,
  item_menu text NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_convite TO authenticated;
GRANT ALL ON public.permissoes_convite TO service_role;

ALTER TABLE public.permissoes_convite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage invite permissions"
ON public.permissoes_convite FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_permissoes_convite_convite_id ON public.permissoes_convite(convite_id);