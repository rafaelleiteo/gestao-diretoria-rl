-- =====================================================================
-- PROPOSTA: quadro "Metas" (objetivos de evolucao por area)
-- Arquivo: supabase/proposals/20261111_metas.sql
--
-- SOMENTE PROPOSTA. Nada aqui foi executado.
-- Quem executa e o Rafael, no SQL Editor do Supabase, bloco por bloco.
--
-- Uso exclusivo do admin. Acesso controlado por public.is_admin(auth.uid()),
-- no mesmo padrao de financeiro_lancamentos.
--
-- Escopo: somente o schema public. Nao toca em consultorio, auth, storage
-- nem em tabelas existentes.
--
-- Ordem dos blocos:
--   A) ESTADO ANTERIOR
--   B) CRIACAO (transacao)
--   C) VERIFICACAO
--   D) MEDICAO DA TABELA METAS (begin/rollback, nao deixa rastro)
--   E) DADOS DE TESTE (opcional)
--   F) REVERSAO (comentada)
--
-- Dica: o SQL Editor mostra somente o resultado do ultimo comando.
-- Rode cada consulta de leitura separadamente (selecione e rode).
-- =====================================================================


-- =====================================================================
-- A) ESTADO ANTERIOR
-- =====================================================================

-- A.1) public.metas nao existe. Esperado: metas_existe = false,
--      funcao_trigger_existe = false.
select
  to_regclass('public.metas') is not null as metas_existe,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'metas_before_update'
  ) as funcao_trigger_existe;

-- A.2) Foto estrutural do schema consultorio (somente leitura, sem contar
--      linhas). Anote o resultado. Ele deve ser IDENTICO ao do bloco C.6.
select
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and c.relkind in ('r', 'p'))                       as tabelas,
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and c.relkind in ('v', 'm'))                       as views,
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'consultorio')                     as funcoes,
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and not t.tgisinternal)                            as triggers,
  (select count(*)
     from pg_policies
    where schemaname = 'consultorio')                    as policies,
  (select md5(coalesce(string_agg(
            concat_ws('|', tablename, policyname, permissive, roles::text,
                      cmd, coalesce(qual, ''), coalesce(with_check, '')),
            E'\n' order by tablename, policyname), ''))
     from pg_policies
    where schemaname = 'consultorio')                    as md5_policies;


-- =====================================================================
-- B) CRIACAO
-- =====================================================================

begin;

create table public.metas (
  id                 uuid primary key default gen_random_uuid(),
  area_gestao        text not null
                     check (area_gestao in (
                       'diretoria', 'financeiro', 'consultorio', 'gestao',
                       'versa3d', 'especializacao', 'graduacao', 'doutorado',
                       'dentistas-petropolis', 'connect-lab'
                     )),
  tipo               text not null
                     check (tipo in ('tarefa', 'decisao', 'ideia', 'bloqueio')),
  titulo             text not null,
  -- minusculas, sem acento, sem espacos duplicados; preenchido pela aplicacao
  titulo_normalizado text not null,
  detalhe            text,
  projeto            text not null
                     check (projeto in (
                       'Plataforma Gestão', 'Ortounifase', 'Consultório',
                       'Versa3D', 'Dentistas Petrópolis', 'Financeira',
                       'Versa3D Medidor', 'Versa3D Inicial', 'LabConect'
                     )),
  frente             text
                     check (frente in (
                       'Técnico', 'Jurídico', 'Comercial', 'Financeiro',
                       'Operação', 'Conteúdo', 'Pessoas'
                     )),
  responsaveis       text[] not null default '{}'
                     check (responsaveis <@ array['Rafael', 'Daniel', 'Terceiro', 'Indefinido']::text[]),
  nome_terceiro      text,
  prioridade         text not null
                     check (prioridade in ('urgente', 'importante', 'depois')),
  prazo              date,
  status             text not null default 'backlog'
                     check (status in (
                       'backlog', 'a_fazer', 'em_andamento', 'aguardando',
                       'concluido', 'descartado'
                     )),
  origem_discussao   text
                     check (origem_discussao in (
                       'sugestao_rafael', 'sugestao_daniel', 'discutido_ambos'
                     )),
  fonte              text,
  -- o que foi decidido ou como foi resolvido (principalmente ao fechar
  -- uma decisao ou um bloqueio)
  resolucao          text,
  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now(),
  concluido_em       timestamptz
);

create unique index metas_projeto_titulo_normalizado_key
  on public.metas (projeto, titulo_normalizado);

-- Trigger: atualiza atualizado_em e preenche ou limpa concluido_em.
--   status passa a 'concluido'  -> concluido_em = now()
--   status continua 'concluido' -> mantem concluido_em (preenche se vazio)
--   qualquer outro status       -> concluido_em = null
create function public.metas_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();

  if new.status = 'concluido' then
    if old.status is distinct from 'concluido' or new.concluido_em is null then
      new.concluido_em := now();
    end if;
  else
    new.concluido_em := null;
  end if;

  return new;
end;
$$;

create trigger metas_before_update
  before update on public.metas
  for each row
  execute function public.metas_before_update();

-- RLS: somente admin
alter table public.metas enable row level security;

create policy "Admins can manage metas"
  on public.metas
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Privilegios
-- Os privilegios padrao do Supabase dao ALL (inclusive TRUNCATE, que ignora
-- a RLS) ao anon, ao authenticated e ao service_role em tabelas novas do
-- public. Por isso: revoga tudo primeiro e concede somente o necessario.
revoke all on table public.metas from anon, authenticated, service_role;
grant select, insert, update, delete on table public.metas to authenticated;
grant select, insert, update, delete on table public.metas to service_role;

commit;


-- =====================================================================
-- C) VERIFICACAO
-- =====================================================================

-- C.1) Tabela existe e RLS ligada. Esperado: 1 linha, rls_ligada = true.
select
  n.nspname as schema,
  c.relname as tabela,
  c.relrowsecurity as rls_ligada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'metas';

-- C.2) Colunas. Esperado: 19 linhas.
select ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'metas'
order by ordinal_position;

-- C.3) Policy. Esperado: 1 linha, cmd = ALL, roles = {authenticated},
--      qual e with_check com is_admin(auth.uid()).
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'metas';

-- C.4) Grants. Esperado: authenticated e service_role com exatamente
--      DELETE, INSERT, SELECT, UPDATE (sem TRUNCATE). O postgres aparece
--      por ser o dono da tabela. O anon NAO pode aparecer.
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'metas'
group by grantee
order by grantee;

-- C.4b) Prova direta para o anon. Esperado: tudo false.
select
  has_table_privilege('anon', 'public.metas', 'select') as anon_select,
  has_table_privilege('anon', 'public.metas', 'insert') as anon_insert,
  has_table_privilege('anon', 'public.metas', 'update') as anon_update,
  has_table_privilege('anon', 'public.metas', 'delete') as anon_delete;

-- C.5) Trigger. Esperado: 1 linha, BEFORE UPDATE, funcao metas_before_update.
select
  t.tgname as trigger,
  pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
where t.tgrelid = 'public.metas'::regclass
  and not t.tgisinternal;

-- C.5b) Indice unico. Esperado: metas_projeto_titulo_normalizado_key.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'metas';

-- C.6) Foto estrutural do consultorio DE NOVO.
--      Deve ser IDENTICA ao resultado do bloco A.2.
select
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and c.relkind in ('r', 'p'))                       as tabelas,
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and c.relkind in ('v', 'm'))                       as views,
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'consultorio')                     as funcoes,
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'consultorio'
      and not t.tgisinternal)                            as triggers,
  (select count(*)
     from pg_policies
    where schemaname = 'consultorio')                    as policies,
  (select md5(coalesce(string_agg(
            concat_ws('|', tablename, policyname, permissive, roles::text,
                      cmd, coalesce(qual, ''), coalesce(with_check, '')),
            E'\n' order by tablename, policyname), ''))
     from pg_policies
    where schemaname = 'consultorio')                    as md5_policies;


-- =====================================================================
-- D) MEDICAO DA TABELA METAS
--    Roda dentro de begin/rollback: nao deixa rastro.
--    Selecione o bloco inteiro (do begin ao rollback) e rode de uma vez.
--    Os resultados aparecem no select final e tambem nas mensagens
--    (RAISE NOTICE). A tabela temporaria some no rollback.
--
--    Esperado:
--      1 | a) anon: select                     | OK: erro de permissao ...
--      2 | b) authenticated comum: is_admin    | OK: false
--      3 | b) authenticated comum: select      | OK: count = 0
--      4 | b) authenticated comum: insert      | OK: bloqueado pela RLS ...
-- =====================================================================

begin;

create temp table _medicao_metas (
  ordem     int,
  teste     text,
  resultado text
) on commit drop;

do $$
declare
  v_sub   uuid := gen_random_uuid();  -- sub aleatorio, nao existe em profiles
  v_count bigint;
  v_admin boolean;
  v_a     text;
  v_b0    text;
  v_b1    text;
  v_b2    text;
begin
  -- a) como anon: select deve dar erro de permissao
  begin
    execute 'set local role anon';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_a := 'FALHOU: anon conseguiu ler (' || v_count || ' linhas)';
  exception
    when insufficient_privilege then
      v_a := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then
      v_a := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- b) como authenticated comum, com sub aleatorio no JWT
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_sub, 'role', 'authenticated')::text,
    true
  );

  -- b.0) sanidade: o sub aleatorio nao e admin
  v_admin := public.is_admin(v_sub);
  v_b0 := case when v_admin then 'FALHOU: true' else 'OK: false' end;

  -- b.1) select count(*) deve dar 0
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_b1 := case when v_count = 0 then 'OK: count = 0'
                 else 'FALHOU: count = ' || v_count end;
  exception
    when others then
      v_b1 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- b.2) insert deve ser bloqueado pela RLS (valores validos nos checks,
  --      para que o bloqueio venha somente da policy)
  begin
    execute 'set local role authenticated';
    execute $ins$
      insert into public.metas
        (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade, fonte)
      values
        ('versa3d', 'tarefa', 'Medicao RLS', 'medicao rls', 'Versa3D', 'depois', 'medicao')
    $ins$;
    execute 'reset role';
    v_b2 := 'FALHOU: insert aceito';
  exception
    when insufficient_privilege then
      v_b2 := 'OK: bloqueado pela RLS (' || sqlerrm || ')';
    when others then
      v_b2 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';

  insert into _medicao_metas values
    (1, 'a) anon: select',                  v_a),
    (2, 'b) authenticated comum: is_admin', v_b0),
    (3, 'b) authenticated comum: select',   v_b1),
    (4, 'b) authenticated comum: insert',   v_b2);

  raise notice 'a) anon select: %', v_a;
  raise notice 'b) is_admin: %', v_b0;
  raise notice 'b) authenticated select: %', v_b1;
  raise notice 'b) authenticated insert: %', v_b2;
end;
$$;

select ordem, teste, resultado
from _medicao_metas
order by ordem;

rollback;

-- c) Como admin (teste pelo app, depois do proximo PR que traz a tela):
--    1. Entrar no app de producao com a conta Google do Rafael (role admin
--       em public.profiles).
--    2. Abrir a tela Metas. Ela deve carregar sem erro (lista vazia, ou as
--       3 linhas de teste se o bloco E tiver sido rodado).
--    3. Criar uma meta, editar o titulo e mudar o status para 'concluido'.
--    4. No SQL Editor, conferir:
--         select titulo, status, atualizado_em, concluido_em
--         from public.metas order by atualizado_em desc limit 5;
--       concluido_em deve estar preenchido e atualizado_em deve ser maior
--       que criado_em.
--    5. Voltar o status para 'a_fazer' e conferir que concluido_em ficou null.
--    6. Abrir o app numa janela anonima, sem login: nenhuma meta deve
--       aparecer.


-- =====================================================================
-- E) DADOS DE TESTE (OPCIONAL)
--    Rode somente se quiser ver dados na tela. Todas as linhas ficam
--    marcadas com fonte = 'teste'.
-- =====================================================================

insert into public.metas
  (area_gestao, tipo, titulo, titulo_normalizado, projeto, frente,
   responsaveis, nome_terceiro, prioridade, status, origem_discussao, fonte)
values
  ('versa3d', 'tarefa',   'Meta teste 1', 'meta teste 1', 'Versa3D',         'Técnico',
   array['Rafael']::text[],           null,               'urgente',    'a_fazer',    null,              'teste'),
  ('versa3d', 'decisao',  'Meta teste 2', 'meta teste 2', 'Versa3D Medidor', 'Comercial',
   array['Rafael', 'Daniel']::text[], null,               'importante', 'backlog',    'sugestao_rafael', 'teste'),
  ('versa3d', 'bloqueio', 'Meta teste 3', 'meta teste 3', 'Versa3D Inicial', 'Operação',
   array['Terceiro']::text[],         'Fornecedor teste', 'depois',     'aguardando', null,              'teste')
returning id, titulo, projeto, status;

-- Conferencia: esperado 3 linhas.
-- select titulo, projeto, frente, responsaveis, prioridade, status
-- from public.metas where fonte = 'teste' order by titulo;

-- Limpeza dos dados de teste:
-- delete from public.metas where fonte = 'teste';


-- =====================================================================
-- F) REVERSAO (toda comentada; descomente somente se for desfazer)
--    Apaga a tabela e TODOS os dados dela.
-- =====================================================================

-- begin;
-- drop trigger if exists metas_before_update on public.metas;
-- drop table if exists public.metas;
-- drop function if exists public.metas_before_update();
-- commit;
--
-- Conferencia apos a reversao: esperado metas_existe = false e
-- funcao_trigger_existe = false, e a foto do consultorio (A.2) igual.
-- select
--   to_regclass('public.metas') is not null as metas_existe,
--   exists (
--     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'metas_before_update'
--   ) as funcao_trigger_existe;
