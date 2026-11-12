-- =====================================================================
-- PROPOSTA: fechar ao papel anon as tabelas da Gestao que hoje estao
--   abertas (qualquer pessoa com a URL do site le e apaga) e deixar
--   o acesso somente para admin (authenticated + is_admin).
-- Arquivo: supabase/proposals/20261112_tabelas_admin.sql
--
-- SOMENTE PROPOSTA. Nada aqui foi executado.
-- Quem executa e o Rafael, no SQL Editor do Supabase, bloco por bloco.
--
-- Tabelas afetadas (somente estas 12, todas do schema public):
--   inbox_items
--   pagamentos_recorrentes
--   pagamentos_recorrentes_registro
--   prompts
--   tarefas_recorrentes
--   tarefas_recorrentes_mensal_item
--   tarefas_recorrentes_mensal_registro
--   protocolos
--   documento_modelos
--   configuracao_documentos
--   links_rapidos
--   rotina_cards
--
-- Estado final desejado (igual nas 12):
--   RLS ligada.
--   Uma unica policy por tabela:
--     FOR ALL TO authenticated
--     USING      (public.is_admin(auth.uid()))
--     WITH CHECK (public.is_admin(auth.uid()))
--   anon          : nenhum privilegio.
--   authenticated : SELECT, INSERT, UPDATE, DELETE (filtrados pela policy).
--   service_role  : SELECT, INSERT, UPDATE, DELETE garantidos. Os grants
--                   que ele ja tiver alem disso (TRUNCATE etc.) nao sao
--                   revogados aqui.
--   PUBLIC        : nenhum privilegio (revogado junto, senao o anon herda).
--
-- Como o app acessa estas tabelas (conferido no codigo em 12/11/2026):
--   - Componentes e rotas no navegador (Inbox, InboxSummary,
--     PagamentosRecorrentes, TarefasRecorrentes, TarefasRecorrentesMensal,
--     envio-em-lote, gestao.prompts, protocolos, $area.protocolos,
--     consultorio.modelos-documentos): cliente do navegador, com a sessao
--     do usuario logado (role authenticated). Funciona para admin.
--   - rotina_cards: server functions com supabaseAdmin (service_role).
--   - Hooks /api/public/hooks/*: createClient com SUPABASE_SERVICE_ROLE_KEY.
--   - links_rapidos: server functions. SO FUNCIONA depois do merge do
--     PR #11 (claude/links-servidor), que troca o cliente publico pelo
--     cliente do usuario. Sem ele, os links rapidos quebram.
--
-- PRE-REQUISITOS antes do bloco B:
--   1. PR #11 com merge e publicado em producao.
--   2. A.0 a A.7 rodados e guardados (principalmente A.4).
--   3. Ciencia de que usuarios NAO admin (colaboradores) perdem acesso a
--      estas 12 tabelas, mesmo que o painel de permissoes libere a tela
--      (ex.: Prompts, Protocolos). A tela abre, mas vem vazia ou da erro
--      ao gravar.
--
-- Escopo: somente as 12 tabelas acima. Nao toca em triggers, em outras
-- tabelas, no schema consultorio, em auth nem em storage. O bloco A.7
-- (storage) e SOMENTE LEITURA.
--
-- Ordem dos blocos:
--   A) ESTADO ANTERIOR (inclui A.0, trava de seguranca, e A.7, storage)
--   B) MUDANCA (transacao)
--   C) VERIFICACAO
--   D) MEDICAO (begin/rollback, nao deixa rastro)
--   E) TESTE NO APP (manual, sem SQL)
--   F) REVERSAO (comentada, modelo a conferir contra o bloco A)
--
-- Dica: o SQL Editor mostra somente o resultado do ultimo comando.
-- Rode cada consulta de leitura separadamente (selecione e rode).
-- =====================================================================


-- =====================================================================
-- A) ESTADO ANTERIOR
--    Rode TODAS as consultas deste bloco e guarde os resultados
--    (principalmente A.4, que e a base da reversao).
-- =====================================================================

-- A.0) TRAVA DE SEGURANCA. Rode A.0a a A.0e ANTES de qualquer outra coisa.
--
--   Tabelas da Gestao no schema public, conforme o repositorio
--   (supabase/migrations, supabase/schema_completo.sql e src/):
--     configuracao_documentos
--     convites
--     documento_modelos
--     financeiro_areas
--     financeiro_lancamentos
--     fornecedores_conhecidos
--     inbox_items
--     links_rapidos
--     metas                     (somente se a proposta 20261111_metas.sql
--                                ja tiver sido executada)
--     pagamentos_recorrentes
--     pagamentos_recorrentes_registro
--     permissoes_convite
--     permissoes_usuario
--     profiles
--     prompts
--     protocolos
--     rotina_cards
--     tarefas_recorrentes
--     tarefas_recorrentes_mensal_item
--     tarefas_recorrentes_mensal_registro
--
--   Se aparecer qualquer tabela que nao seja da Gestao, PARE: pode ser de
--   outro sistema (LabConect) e este script nao deve ser executado sem
--   revisar.

-- A.0a) Todas as tabelas do schema public (somente nomes).
--       Esperado: somente nomes da lista acima.
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- A.0b) As 12 tabelas alvo existem? Esperado: 12 linhas, existe = true.
select t.nome as tabela,
       to_regclass('public.' || t.nome) is not null as existe
from (values
  ('inbox_items'), ('pagamentos_recorrentes'), ('pagamentos_recorrentes_registro'),
  ('prompts'), ('tarefas_recorrentes'), ('tarefas_recorrentes_mensal_item'),
  ('tarefas_recorrentes_mensal_registro'), ('protocolos'), ('documento_modelos'),
  ('configuracao_documentos'), ('links_rapidos'), ('rotina_cards')
) as t(nome)
order by t.nome;

-- A.0c) VIEWS (de qualquer schema, inclusive consultorio e outros) que
--       leem alguma das 12 tabelas.
--       Esperado: 0 linhas.
--       Se aparecer alguma: uma view sem security_invoker roda com o dono
--       (normalmente postgres) e IGNORA a RLS. Se anon_le = true, o anon
--       continua lendo os dados por ela. Se o schema nao for public,
--       pode ser de outro sistema que vai quebrar. PARE e avise.
select distinct
  vn.nspname                            as schema_view,
  v.relname                             as view,
  case v.relkind when 'v' then 'view' when 'm' then 'materialized view' end as tipo,
  pg_get_userbyid(v.relowner)           as dono,
  coalesce(array_to_string(v.reloptions, ', '), '') as opcoes,  -- procure security_invoker=true
  t.relname                             as tabela_usada,
  has_table_privilege('anon', v.oid, 'select')          as anon_le,
  has_table_privilege('authenticated', v.oid, 'select') as authenticated_le
from pg_depend d
join pg_rewrite r  on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
join pg_class v    on v.oid = r.ev_class
join pg_namespace vn on vn.oid = v.relnamespace
join pg_class t    on t.oid = d.refobjid and d.refclassid = 'pg_class'::regclass
join pg_namespace tn on tn.oid = t.relnamespace
where tn.nspname = 'public'
  and t.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
  and v.oid <> t.oid
order by 1, 2, 6;

-- A.0d) FUNCOES (de qualquer schema, exceto os do sistema) cujo codigo
--       cita alguma das 12 tabelas. Busca por texto (palavra inteira).
--       Esperado: somente as funcoes de trigger da propria Gestao (ex.:
--       a que preenche inbox_items.concluido_em) e, se existirem, as
--       funcoes de cron da Gestao.
--       Atencao para:
--         - schema diferente de public (ex.: consultorio): outro sistema
--           usa a tabela e pode quebrar. PARE e avise.
--         - seguranca_definer = true e anon_executa = true: a funcao roda
--           como o dono e ignora a RLS; o anon continua chegando aos
--           dados por ela. PARE e avise.
--         - seguranca_definer = false e chamada por cron ou por outro
--           sistema como anon: vai passar a dar erro de permissao.
with alvo(nome) as (
  values ('inbox_items'), ('pagamentos_recorrentes'), ('pagamentos_recorrentes_registro'),
         ('prompts'), ('tarefas_recorrentes'), ('tarefas_recorrentes_mensal_item'),
         ('tarefas_recorrentes_mensal_registro'), ('protocolos'), ('documento_modelos'),
         ('configuracao_documentos'), ('links_rapidos'), ('rotina_cards')
)
select
  n.nspname                                   as schema_funcao,
  p.proname                                   as funcao,
  pg_get_function_identity_arguments(p.oid)   as argumentos,
  p.prosecdef                                 as seguranca_definer,
  pg_get_userbyid(p.proowner)                 as dono,
  has_function_privilege('anon', p.oid, 'execute')          as anon_executa,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_executa,
  string_agg(alvo.nome, ', ' order by alvo.nome)            as tabelas_citadas
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join alvo on p.prosrc ~* ('\m' || alvo.nome || '\M')
where n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
group by n.nspname, p.proname, p.oid, p.prosecdef, p.proowner
order by 1, 2;

-- A.0e) POLICIES de OUTRAS tabelas (qualquer schema) que citam alguma das
--       12 tabelas no using ou no with check (ex.: exists (select ...)).
--       Esperado: 0 linhas. Se aparecer, essa policy passa a dar erro de
--       permissao para anon. PARE e avise.
with alvo(nome) as (
  values ('inbox_items'), ('pagamentos_recorrentes'), ('pagamentos_recorrentes_registro'),
         ('prompts'), ('tarefas_recorrentes'), ('tarefas_recorrentes_mensal_item'),
         ('tarefas_recorrentes_mensal_registro'), ('protocolos'), ('documento_modelos'),
         ('configuracao_documentos'), ('links_rapidos'), ('rotina_cards')
)
select p.schemaname, p.tablename, p.policyname, p.roles, p.cmd,
       string_agg(alvo.nome, ', ' order by alvo.nome) as tabelas_citadas
from pg_policies p
join alvo on coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ~* ('\m' || alvo.nome || '\M')
where not (p.schemaname = 'public' and p.tablename = alvo.nome)
group by p.schemaname, p.tablename, p.policyname, p.roles, p.cmd
order by 1, 2, 3;

-- A.1) RLS das 12 tabelas e a funcao public.is_admin(uuid).
--      Esperado: 12 linhas; is_admin_existe = true.
--      is_admin_definer: se for false, a funcao le public.profiles com a
--      RLS do proprio usuario. Isso funciona porque o usuario consegue
--      ler o proprio perfil (proposta 20261112_escalada.sql). Anote.
select
  c.relname                    as tabela,
  c.relrowsecurity             as rls_ligada,
  c.relforcerowsecurity        as rls_forcada,
  pg_get_userbyid(c.relowner)  as dono,
  to_regprocedure('public.is_admin(uuid)') is not null as is_admin_existe,
  (select p.prosecdef from pg_proc p
    where p.oid = to_regprocedure('public.is_admin(uuid)')) as is_admin_definer
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
order by c.relname;

-- A.2) Policies atuais das 12 tabelas (pg_policies).
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
order by tablename, policyname;

-- A.3) Grants atuais das 12 tabelas, lidos direto da ACL (exato, inclui
--      TRUNCATE, REFERENCES e TRIGGER). O dono da tabela fica de fora.
select
  c.relname                                         as tabela,
  case when a.grantee = 0 then 'PUBLIC'
       else pg_get_userbyid(a.grantee) end          as grantee,
  string_agg(a.privilege_type, ', ' order by a.privilege_type) as privilegios,
  pg_get_userbyid(a.grantor)                        as grantor
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
  and a.grantee <> c.relowner
group by c.relname, a.grantee, a.grantor
order by c.relname, 2;

-- A.3b) Grants por coluna (se houver). Normalmente vazio.
select
  c.relname as tabela,
  att.attname as coluna,
  case when a.grantee = 0 then 'PUBLIC'
       else pg_get_userbyid(a.grantee) end as grantee,
  a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
cross join lateral aclexplode(att.attacl) a
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
order by 1, 2, 3, 4;

-- A.4) SQL DE REVERSAO EXATA, gerado a partir do estado atual do banco.
--      Resultado: 1 linha com um texto grande. COPIE e GUARDE esse texto
--      (por exemplo, num arquivo local). Ele recria exatamente a RLS, os
--      grants (tabela e coluna) e as policies de hoje. E usado no bloco F.
with alvo(nome) as (
  values ('inbox_items'), ('pagamentos_recorrentes'), ('pagamentos_recorrentes_registro'),
         ('prompts'), ('tarefas_recorrentes'), ('tarefas_recorrentes_mensal_item'),
         ('tarefas_recorrentes_mensal_registro'), ('protocolos'), ('documento_modelos'),
         ('configuracao_documentos'), ('links_rapidos'), ('rotina_cards')
),
tab as (
  select c.oid, c.relname, c.relowner, c.relacl, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join alvo on alvo.nome = c.relname
  where n.nspname = 'public'
),
linhas as (
  -- RLS
  select 1 as ordem, relname as tabela,
         format('alter table public.%I %s row level security;',
                relname, case when relrowsecurity then 'enable' else 'disable' end) as linha
  from tab
  union all
  -- limpa os grants que a mudanca deixou
  select 2, relname,
         format('revoke all on table public.%I from public, anon, authenticated, service_role;', relname)
  from tab
  union all
  -- grants de tabela (exceto dono)
  select 3, t.relname,
         format('grant %s on table public.%I to %s%s;',
                a.privilege_type, t.relname,
                case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end,
                case when a.is_grantable then ' with grant option' else '' end)
  from tab t
  cross join lateral aclexplode(t.relacl) a
  where a.grantee <> t.relowner
  union all
  -- grants de coluna
  select 4, t.relname,
         format('grant %s (%I) on table public.%I to %s%s;',
                a.privilege_type, att.attname, t.relname,
                case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end,
                case when a.is_grantable then ' with grant option' else '' end)
  from tab t
  join pg_attribute att on att.attrelid = t.oid and att.attnum > 0 and not att.attisdropped
  cross join lateral aclexplode(att.attacl) a
  union all
  -- policies
  select 5, p.tablename,
         format('create policy %I on public.%I as %s for %s to %s%s%s;',
                p.policyname, p.tablename, p.permissive, p.cmd,
                (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
                   from unnest(p.roles) as r),
                case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
                case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end)
  from pg_policies p
  join alvo on alvo.nome = p.tablename
  where p.schemaname = 'public'
)
select string_agg(linha, E'\n' order by ordem, tabela, linha) as sql_reversao
from linhas;

-- A.5) Foto estrutural do schema consultorio (somente leitura, sem contar
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

-- A.6) Foto dos triggers das 12 tabelas (somente leitura). Anote.
--      Deve ser IDENTICA ao resultado do bloco C.5 (esta proposta nao
--      toca em triggers).
select
  count(*) as triggers,
  md5(coalesce(string_agg(c.relname || '|' || t.tgname || '|' || t.tgenabled::text || '|'
                          || pg_get_triggerdef(t.oid),
                          E'\n' order by c.relname, t.tgname), '')) as md5_triggers
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards');

-- A.7) STORAGE, SOMENTE LEITURA. Esta proposta NAO muda nada no storage.
--      Serve para planejar uma proposta separada.

-- A.7a) Todas as policies de storage.objects e storage.buckets.
--       A coluna filtra_bucket marca, por busca de texto, se o using ou o
--       with check restringem a um bucket:
--         storage.objects : procura bucket_id
--         storage.buckets : procura a coluna id ou name
--       filtra_bucket = 'NAO' quer dizer que a policy vale para TODOS os
--       buckets (inclusive os do consultorio e do LabConect). Sao essas as
--       mais perigosas, principalmente se roles tiver anon ou public.
--       Confira o texto a olho tambem: a busca so ve se a palavra aparece.
--
--       Pelo repositorio (supabase/migrations/20260724011439_*.sql e
--       schema_completo.sql) existem 4 policies da Gestao em
--       storage.objects, TODAS filtram por bucket_id = 'documento-timbre',
--       mas TODAS valem para public (inclui anon), inclusive INSERT,
--       UPDATE e DELETE:
--         "Public read documento-timbre"    SELECT  filtra bucket_id: sim
--         "Public insert documento-timbre"  INSERT  filtra bucket_id: sim
--         "Public update documento-timbre"  UPDATE  filtra bucket_id: sim
--         "Public delete documento-timbre"  DELETE  filtra bucket_id: sim
--       Qualquer outra policy que aparecer veio de fora do repositorio
--       (outro sistema ou criada no painel): anote quais dao 'NAO'.
select
  p.tablename                                   as tabela,
  p.policyname                                  as policy,
  p.cmd                                         as comando,
  p.roles                                       as papeis,
  p.permissive,
  p.qual                                        as using_expr,
  p.with_check                                  as with_check_expr,
  case
    when p.tablename = 'objects'
         and (coalesce(p.qual, '') ~* '\mbucket_id\M'
              or coalesce(p.with_check, '') ~* '\mbucket_id\M') then 'sim'
    when p.tablename = 'buckets'
         and (coalesce(p.qual, '') ~* '\m(id|name)\M'
              or coalesce(p.with_check, '') ~* '\m(id|name)\M') then 'sim'
    else 'NAO'
  end                                           as filtra_bucket
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename in ('objects', 'buckets')
order by p.tablename, filtra_bucket, p.policyname;

-- A.7b) RLS de storage.objects e storage.buckets.
select c.relname as tabela, c.relrowsecurity as rls_ligada, c.relforcerowsecurity as rls_forcada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relname in ('objects', 'buckets')
order by c.relname;

-- A.7c) Buckets e o flag public.
--       public = true: qualquer pessoa baixa os arquivos pela URL publica,
--       sem passar por policy nenhuma.
--       Pelo repositorio, a Gestao usa o bucket 'documento-timbre'.
select id, name, public, created_at
from storage.buckets
order by name;


-- =====================================================================
-- B) MUDANCA
--    Rode somente se:
--      - A.0a mostrar somente tabelas da Gestao;
--      - A.0b mostrar as 12 com existe = true;
--      - A.0c e A.0e vierem vazias, e A.0d sem nada de outro schema;
--      - A.1 mostrar is_admin_existe = true;
--      - o PR #11 (links rapidos) ja estiver em producao.
--    Selecione do begin ao commit e rode de uma vez. Se qualquer comando
--    falhar, nada e aplicado.
-- =====================================================================

begin;

-- B.0) Trava: as 12 tabelas e public.is_admin(uuid) precisam existir.
do $$
declare
  t text;
begin
  foreach t in array array[
    'inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
    'configuracao_documentos', 'links_rapidos', 'rotina_cards'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Tabela public.% nao existe. Abortando.', t;
    end if;
  end loop;
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'public.is_admin(uuid) nao existe. Abortando.';
  end if;
end;
$$;

-- B.1) Apaga TODAS as policies atuais das 12 tabelas (os nomes no banco
--      podem divergir dos arquivos, por isso o laco).
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                        'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                        'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                        'configuracao_documentos', 'links_rapidos', 'rotina_cards')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- B.2) RLS ligada nas 12 (idempotente).
alter table public.inbox_items                         enable row level security;
alter table public.pagamentos_recorrentes              enable row level security;
alter table public.pagamentos_recorrentes_registro     enable row level security;
alter table public.prompts                             enable row level security;
alter table public.tarefas_recorrentes                 enable row level security;
alter table public.tarefas_recorrentes_mensal_item     enable row level security;
alter table public.tarefas_recorrentes_mensal_registro enable row level security;
alter table public.protocolos                          enable row level security;
alter table public.documento_modelos                   enable row level security;
alter table public.configuracao_documentos             enable row level security;
alter table public.links_rapidos                       enable row level security;
alter table public.rotina_cards                        enable row level security;

-- B.3) Revoga tudo (tabela e colunas) de public, anon e authenticated.
--      Inclui TRUNCATE, REFERENCES e TRIGGER. service_role nao e revogado.
revoke all on table public.inbox_items                         from public, anon, authenticated;
revoke all on table public.pagamentos_recorrentes              from public, anon, authenticated;
revoke all on table public.pagamentos_recorrentes_registro     from public, anon, authenticated;
revoke all on table public.prompts                             from public, anon, authenticated;
revoke all on table public.tarefas_recorrentes                 from public, anon, authenticated;
revoke all on table public.tarefas_recorrentes_mensal_item     from public, anon, authenticated;
revoke all on table public.tarefas_recorrentes_mensal_registro from public, anon, authenticated;
revoke all on table public.protocolos                          from public, anon, authenticated;
revoke all on table public.documento_modelos                   from public, anon, authenticated;
revoke all on table public.configuracao_documentos             from public, anon, authenticated;
revoke all on table public.links_rapidos                       from public, anon, authenticated;
revoke all on table public.rotina_cards                        from public, anon, authenticated;

-- B.4) Concede SELECT, INSERT, UPDATE, DELETE ao authenticated e ao
--      service_role. anon fica sem nada.
grant select, insert, update, delete on table public.inbox_items                         to authenticated, service_role;
grant select, insert, update, delete on table public.pagamentos_recorrentes              to authenticated, service_role;
grant select, insert, update, delete on table public.pagamentos_recorrentes_registro     to authenticated, service_role;
grant select, insert, update, delete on table public.prompts                             to authenticated, service_role;
grant select, insert, update, delete on table public.tarefas_recorrentes                 to authenticated, service_role;
grant select, insert, update, delete on table public.tarefas_recorrentes_mensal_item     to authenticated, service_role;
grant select, insert, update, delete on table public.tarefas_recorrentes_mensal_registro to authenticated, service_role;
grant select, insert, update, delete on table public.protocolos                          to authenticated, service_role;
grant select, insert, update, delete on table public.documento_modelos                   to authenticated, service_role;
grant select, insert, update, delete on table public.configuracao_documentos             to authenticated, service_role;
grant select, insert, update, delete on table public.links_rapidos                       to authenticated, service_role;
grant select, insert, update, delete on table public.rotina_cards                        to authenticated, service_role;

-- B.5) Uma unica policy por tabela: somente admin, para tudo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
    'configuracao_documentos', 'links_rapidos', 'rotina_cards'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))',
      'Somente admin', t
    );
  end loop;
end;
$$;

commit;


-- =====================================================================
-- C) VERIFICACAO
-- =====================================================================

-- C.1) RLS. Esperado: 12 linhas, rls_ligada = true.
select c.relname as tabela, c.relrowsecurity as rls_ligada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
order by c.relname;

-- C.2) Policies. Esperado: exatamente 12 linhas, uma por tabela, todas:
--   policyname = Somente admin | permissive = PERMISSIVE
--   roles = {authenticated} | cmd = ALL
--   qual = with_check = is_admin(auth.uid())
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
order by tablename, policyname;

-- C.3) Grants (ACL, dono fora). Esperado, para cada uma das 12:
--   authenticated | DELETE, INSERT, SELECT, UPDATE
--   service_role  | pelo menos DELETE, INSERT, SELECT, UPDATE (pode ter
--                   mais, ex.: TRUNCATE, se ja tinha antes)
--   Nenhuma linha para anon nem PUBLIC.
--   Se anon ou PUBLIC aparecerem, PARE e avise: pode ser grant feito por
--   outro grantor (ex.: supabase_admin), que o revoke do postgres nao
--   remove. Outros papeis internos do Supabase, se aparecerem, nao foram
--   tocados.
select
  c.relname as tabela,
  case when a.grantee = 0 then 'PUBLIC'
       else pg_get_userbyid(a.grantee) end as grantee,
  string_agg(a.privilege_type, ', ' order by a.privilege_type) as privilegios,
  pg_get_userbyid(a.grantor) as grantor
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
  and a.grantee <> c.relowner
group by c.relname, a.grantee, a.grantor
order by c.relname, 2;

-- C.3b) Prova direta com has_table_privilege. Esperado:
--   anon          : tudo false nas 12.
--   authenticated : sel, ins, upd, del = true; trunc, refs, trig = false.
--   service_role  : sel, ins, upd, del = true (o resto, como estava antes).
select
  r.papel,
  t.tabela,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'select')     as sel,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'insert')     as ins,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'update')     as upd,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'delete')     as del,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'truncate')   as trunc,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'references') as refs,
  has_table_privilege(r.papel, 'public.' || t.tabela, 'trigger')    as trig
from (values ('anon'), ('authenticated'), ('service_role')) as r(papel)
cross join (values
  ('inbox_items'), ('pagamentos_recorrentes'), ('pagamentos_recorrentes_registro'),
  ('prompts'), ('tarefas_recorrentes'), ('tarefas_recorrentes_mensal_item'),
  ('tarefas_recorrentes_mensal_registro'), ('protocolos'), ('documento_modelos'),
  ('configuracao_documentos'), ('links_rapidos'), ('rotina_cards')
) as t(tabela)
order by r.papel, t.tabela;

-- C.3c) Grants por coluna para anon/authenticated/PUBLIC. Esperado: 0 linhas.
select c.relname as tabela, att.attname as coluna,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
cross join lateral aclexplode(att.attacl) a
where n.nspname = 'public'
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards')
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'));

-- C.4) Tabelas do public de novo. Esperado: identico ao A.0a.
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- C.5) Triggers das 12 tabelas DE NOVO. Deve ser IDENTICO ao A.6.
select
  count(*) as triggers,
  md5(coalesce(string_agg(c.relname || '|' || t.tgname || '|' || t.tgenabled::text || '|'
                          || pg_get_triggerdef(t.oid),
                          E'\n' order by c.relname, t.tgname), '')) as md5_triggers
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
                    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
                    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
                    'configuracao_documentos', 'links_rapidos', 'rotina_cards');

-- C.6) Foto estrutural do consultorio DE NOVO.
--      Deve ser IDENTICA ao resultado do bloco A.5.
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

-- C.7) Storage nao mudou: rode A.7a e A.7c de novo. Deve ser identico.


-- =====================================================================
-- D) MEDICAO
--    Roda dentro de begin/rollback: nao deixa rastro.
--    Selecione o bloco inteiro (do begin ao rollback) e rode de uma vez.
--    Rode ANTES da mudanca (bloco B) e DEPOIS dela. Antes, varias colunas
--    devem dar FALHOU (e o problema que estamos fechando). Depois, todas
--    devem dar OK.
--
--    Resultado: 1 linha por tabela, com as colunas:
--      anon_select / anon_insert / anon_update / anon_delete
--        update e delete usam "where false" (nao mexem em nenhuma linha).
--        O insert usa "default values" e, se passar (ANTES da mudanca), e
--        desfeito na hora (subtransacao) e de novo no rollback final.
--        A checagem de permissao acontece antes de tudo, entao o esperado
--        DEPOIS e "OK: sem permissao" nas 4 colunas.
--      comum_select
--        authenticated com sub aleatorio, sem perfil (nao admin).
--        Esperado DEPOIS: "OK: 0 visiveis (existem N)".
--      comum_insert
--        Mesmo usuario tenta inserir uma COPIA EXATA de uma linha que ja
--        existe (lida como postgres numa tabela temporaria). A copia
--        satisfaz NOT NULL e checks; a RLS e checada antes da chave
--        unica. Esperado DEPOIS: "OK: barrado pela RLS". ANTES, a RLS
--        deixa passar e o insert para na chave unica (nada e gravado):
--        "FALHOU: a RLS deixou passar". Triggers BEFORE INSERT podem
--        disparar, mas tudo e desfeito no rollback final.
--      admin_select
--        authenticated com o id de um perfil admin real (lido de
--        public.profiles). Esperado ANTES e DEPOIS: "OK: ve N de N".
--        Se nao houver admin, "INCONCLUSIVO".
-- =====================================================================

begin;

create temp table _medicao_tabelas_admin (
  tabela       text,
  anon_select  text,
  anon_insert  text,
  anon_update  text,
  anon_delete  text,
  comum_select text,
  comum_insert text,
  admin_select text
) on commit drop;

do $$
declare
  v_tabs   text[] := array[
    'inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
    'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
    'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
    'configuracao_documentos', 'links_rapidos', 'rotina_cards'];
  t        text;
  v_col    text;
  v_sub    uuid := gen_random_uuid();   -- authenticated comum, sem perfil
  v_admin  uuid;
  v_total  bigint;
  v_count  bigint;
  r_asel text; r_ains text; r_aupd text; r_adel text;
  r_csel text; r_cins text; r_admin text;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;

  foreach t in array v_tabs loop
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

    -- total de linhas, lido como postgres
    execute format('select count(*) from public.%I', t) into v_total;

    -- primeira coluna comum da tabela (nao identity, nao gerada),
    -- usada no update sem efeito
    select att.attname into v_col
    from pg_attribute att
    where att.attrelid = ('public.' || t)::regclass
      and att.attnum > 0 and not att.attisdropped
      and att.attidentity = '' and att.attgenerated = ''
    order by att.attnum
    limit 1;

    -- ---------------------------------------------------------------
    -- anon
    -- ---------------------------------------------------------------
    begin
      execute 'set local role anon';
      execute format('select count(*) from public.%I', t) into v_count;
      execute 'reset role';
      r_asel := 'FALHOU: anon le (' || v_count || ' de ' || v_total || ')';
    exception
      when insufficient_privilege then r_asel := 'OK: sem permissao';
      when others then r_asel := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
    end;

    begin
      execute 'set local role anon';
      execute format('insert into public.%I default values', t);
      -- se chegou aqui, o insert passou: desfaz esta subtransacao
      raise exception using errcode = 'P0001', message = 'medicao_desfazer';
    exception
      when sqlstate 'P0001' then
        if sqlerrm = 'medicao_desfazer' then
          r_ains := 'FALHOU: anon inseriu (desfeito)';
        else
          r_ains := 'INCONCLUSIVO: ' || sqlerrm;
        end if;
      when insufficient_privilege then
        if sqlerrm ilike '%row-level security%' then
          r_ains := 'FALHOU: anon tem grant de insert (barrado so pela RLS)';
        else
          r_ains := 'OK: sem permissao';
        end if;
      when others then
        r_ains := 'FALHOU: anon passou da checagem de permissao (' || sqlstate || ' ' || sqlerrm || ')';
    end;

    begin
      execute 'set local role anon';
      execute format('update public.%I set %I = %I where false', t, v_col, v_col);
      execute 'reset role';
      r_aupd := 'FALHOU: anon tem permissao de update';
    exception
      when insufficient_privilege then r_aupd := 'OK: sem permissao';
      when others then r_aupd := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
    end;

    begin
      execute 'set local role anon';
      execute format('delete from public.%I where false', t);
      execute 'reset role';
      r_adel := 'FALHOU: anon tem permissao de delete';
    exception
      when insufficient_privilege then r_adel := 'OK: sem permissao';
      when others then r_adel := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
    end;

    execute 'reset role';

    -- ---------------------------------------------------------------
    -- authenticated comum (sub aleatorio, nao admin)
    -- ---------------------------------------------------------------
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_sub, 'role', 'authenticated')::text,
      true
    );

    begin
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into v_count;
      execute 'reset role';
      r_csel := case
                  when v_total = 0 then 'INCONCLUSIVO: tabela vazia'
                  when v_count = 0 then 'OK: 0 visiveis (existem ' || v_total || ')'
                  else 'FALHOU: ve ' || v_count || ' de ' || v_total
                end;
    exception
      when insufficient_privilege then r_csel := 'ATENCAO: sem grant de select (' || sqlerrm || ')';
      when others then r_csel := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
    end;

    execute 'reset role';
    if v_total = 0 then
      r_cins := 'INCONCLUSIVO: tabela vazia';
    else
      -- copia de uma linha existente, lida como postgres
      execute format('create temp table _linha_medicao on commit drop as '
                     'select * from public.%I limit 1', t);
      execute 'grant select on _linha_medicao to authenticated';
      begin
        execute 'set local role authenticated';
        execute format('insert into public.%I select * from _linha_medicao', t);
        -- se chegou aqui, o insert passou: desfaz esta subtransacao
        raise exception using errcode = 'P0001', message = 'medicao_desfazer';
      exception
        when sqlstate 'P0001' then
          if sqlerrm = 'medicao_desfazer' then
            r_cins := 'FALHOU: insert aceito (desfeito)';
          else
            r_cins := 'INCONCLUSIVO: ' || sqlerrm;
          end if;
        when insufficient_privilege then
          if sqlerrm ilike '%row-level security%' then
            r_cins := 'OK: barrado pela RLS';
          else
            r_cins := 'ATENCAO: sem grant de insert (' || sqlerrm || ')';
          end if;
        when unique_violation then
          r_cins := 'FALHOU: a RLS deixou passar (parou so na chave unica)';
        when others then
          r_cins := 'INCONCLUSIVO: ' || sqlstate || ' ' || sqlerrm;
      end;
      execute 'reset role';
      drop table _linha_medicao;
    end if;

    execute 'reset role';

    -- ---------------------------------------------------------------
    -- admin real
    -- ---------------------------------------------------------------
    if v_admin is null then
      r_admin := 'INCONCLUSIVO: nenhum perfil admin';
    else
      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', v_admin, 'role', 'authenticated')::text,
        true
      );
      begin
        execute 'set local role authenticated';
        execute format('select count(*) from public.%I', t) into v_count;
        execute 'reset role';
        r_admin := case
                     when v_count = v_total then 'OK: ve ' || v_count || ' de ' || v_total
                     else 'FALHOU: ve ' || v_count || ' de ' || v_total
                   end;
      exception
        when others then r_admin := 'FALHOU: erro ' || sqlstate || ' ' || sqlerrm;
      end;
    end if;

    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

    insert into _medicao_tabelas_admin
    values (t, r_asel, r_ains, r_aupd, r_adel, r_csel, r_cins, r_admin);
  end loop;
end;
$$;

select *
from _medicao_tabelas_admin
order by tabela;

rollback;


-- =====================================================================
-- E) TESTE NO APP (manual, sem SQL)
--    Depois do bloco B, com o PR #11 (links rapidos) ja em producao.
--    Logado com a conta Google do Rafael (admin):
--    1. Caixa de entrada: lista carrega; criar um item de teste, marcar
--       como concluido e apagar. Conferir tambem o resumo da caixa.
--    2. Envio em lote: a tela abre sem erro (nao precisa enviar nada).
--    3. Pagamentos recorrentes: lista carrega; marcar e desmarcar um
--       pagamento do mes.
--    4. Tarefas recorrentes e tarefas recorrentes mensais: lista carrega;
--       marcar e desmarcar um item.
--    5. Gestao > Prompts: lista carrega; criar e apagar um prompt de teste.
--    6. Protocolos (geral e de uma area): lista carrega; abrir um protocolo.
--    7. Consultorio > Modelos de documentos: modelos e configuracao
--       carregam; salvar sem mudar nada.
--    8. Links rapidos de uma area: lista carrega; criar e apagar um link
--       de teste.
--    9. Gestao > Rotina: cards carregam.
--   10. Janela anonima, sem login: nenhuma dessas telas mostra dados.
--   11. (Se houver colaborador) Esperado: as telas acima ficam vazias ou
--       dao erro ao gravar para ele. E consequencia da regra "somente
--       admin", nao um defeito desta proposta.
--   12. No dia seguinte, conferir se os lembretes e o resumo do Telegram
--       continuam saindo (usam service_role, nao devem mudar).
--    Se algo falhar, rodar o bloco F e avisar.
-- =====================================================================


-- =====================================================================
-- F) REVERSAO (toda comentada; descomente somente se for desfazer)
--
--    ATENCAO: os arquivos do repositorio podem divergir do banco. O
--    modelo F.3 foi montado a partir de supabase/schema_completo.sql e
--    serve SOMENTE COMO MODELO. Antes de qualquer uso, ele deve ser
--    conferido contra o resultado REAL do bloco A (A.1, A.2, A.3, A.3b).
--
--    Caminho recomendado (reversao exata):
--      F.1 apaga as policies criadas no bloco B;
--      F.2 cola o texto gerado em A.4, que recria exatamente a RLS, os
--          grants e as policies que existiam antes.
--    Use o modelo F.3 somente se nao tiver guardado o resultado de A.4,
--    e ajuste-o para bater com A.2 e A.3.
--
--    Lembrete: reverter REABRE as 12 tabelas ao anon.
-- =====================================================================

-- begin;
--
-- -- F.1) apaga todas as policies atuais das 12 tabelas
-- do $$
-- declare
--   p record;
-- begin
--   for p in
--     select tablename, policyname
--     from pg_policies
--     where schemaname = 'public'
--       and tablename in ('inbox_items', 'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
--                         'prompts', 'tarefas_recorrentes', 'tarefas_recorrentes_mensal_item',
--                         'tarefas_recorrentes_mensal_registro', 'protocolos', 'documento_modelos',
--                         'configuracao_documentos', 'links_rapidos', 'rotina_cards')
--   loop
--     execute format('drop policy %I on public.%I', p.policyname, p.tablename);
--   end loop;
-- end;
-- $$;
--
-- -- F.2) COLE AQUI o texto gerado em A.4.
--
-- -- F.3) MODELO pelos arquivos (usar somente se F.2 nao for possivel,
-- --      e somente depois de conferir com A.2 e A.3).
-- --      Os privilegios padrao do Supabase costumam dar ALL (inclusive
-- --      TRUNCATE, REFERENCES e TRIGGER) a anon, authenticated e
-- --      service_role; se A.3 mostrou isso, ajuste os grants abaixo.
-- --      As 12 tinham RLS ligada nos arquivos; o B.2 so confirma, entao
-- --      nao ha o que reverter na RLS.
--
-- revoke all on table public.inbox_items                         from public, anon, authenticated, service_role;
-- revoke all on table public.pagamentos_recorrentes              from public, anon, authenticated, service_role;
-- revoke all on table public.pagamentos_recorrentes_registro     from public, anon, authenticated, service_role;
-- revoke all on table public.prompts                             from public, anon, authenticated, service_role;
-- revoke all on table public.tarefas_recorrentes                 from public, anon, authenticated, service_role;
-- revoke all on table public.tarefas_recorrentes_mensal_item     from public, anon, authenticated, service_role;
-- revoke all on table public.tarefas_recorrentes_mensal_registro from public, anon, authenticated, service_role;
-- revoke all on table public.protocolos                          from public, anon, authenticated, service_role;
-- revoke all on table public.documento_modelos                   from public, anon, authenticated, service_role;
-- revoke all on table public.configuracao_documentos             from public, anon, authenticated, service_role;
-- revoke all on table public.links_rapidos                       from public, anon, authenticated, service_role;
-- revoke all on table public.rotina_cards                        from public, anon, authenticated, service_role;
--
-- -- Tabelas abertas a anon e authenticated (mesmo padrao nas 9):
-- --   inbox_items, prompts, tarefas_recorrentes,
-- --   tarefas_recorrentes_mensal_item, tarefas_recorrentes_mensal_registro,
-- --   pagamentos_recorrentes, pagamentos_recorrentes_registro,
-- --   documento_modelos, configuracao_documentos
-- do $$
-- declare
--   t     text;
--   rotulo text;
-- begin
--   foreach t in array array[
--     'inbox_items', 'prompts', 'tarefas_recorrentes',
--     'tarefas_recorrentes_mensal_item', 'tarefas_recorrentes_mensal_registro',
--     'pagamentos_recorrentes', 'pagamentos_recorrentes_registro',
--     'documento_modelos', 'configuracao_documentos'
--   ] loop
--     execute format('grant select, insert, update, delete on table public.%I to anon, authenticated', t);
--     execute format('grant all on table public.%I to service_role', t);
--     rotulo := case t
--                 when 'inbox_items'         then 'inbox items'
--                 when 'tarefas_recorrentes' then 'tarefas recorrentes'
--                 else t
--               end;
--     execute format('create policy %I on public.%I for select using (true)',
--                    'Public can read ' || rotulo, t);
--     execute format('create policy %I on public.%I for insert with check (true)',
--                    'Public can insert ' || rotulo, t);
--     execute format('create policy %I on public.%I for update using (true) with check (true)',
--                    'Public can update ' || rotulo, t);
--     execute format('create policy %I on public.%I for delete using (true)',
--                    'Public can delete ' || rotulo, t);
--   end loop;
-- end;
-- $$;
--
-- -- protocolos
-- grant select, insert, update, delete on table public.protocolos to authenticated;
-- grant all on table public.protocolos to service_role;
-- create policy "Users can manage their own protocols" on public.protocolos
--   for all to authenticated using (true);
--
-- -- rotina_cards
-- grant select, insert, update, delete on table public.rotina_cards to authenticated;
-- grant all on table public.rotina_cards to service_role;
-- create policy "Users can manage routine cards" on public.rotina_cards
--   for all to authenticated using (true);
--
-- -- links_rapidos
-- grant select, insert, update, delete on table public.links_rapidos to authenticated;
-- grant all on table public.links_rapidos to service_role;
-- create policy "Users can see all links" on public.links_rapidos
--   for select to authenticated using (true);
-- create policy "Users can insert links" on public.links_rapidos
--   for insert to authenticated with check (true);
-- create policy "Users can delete their own links" on public.links_rapidos
--   for delete to authenticated using (true);
--
-- commit;
--
-- Conferencia apos a reversao: rode A.2, A.3 e A.3b de novo. O resultado
-- deve ser IDENTICO ao guardado antes do bloco B. E as fotos do
-- consultorio (A.5) e dos triggers (A.6) devem continuar iguais.
