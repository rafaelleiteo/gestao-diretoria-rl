-- =====================================================================
-- PROPOSTA: fechar no banco a cadeia de escalada de privilegio
--   convite criado pelo proprio usuario > perfil colaborador >
--   alteracao do proprio profiles.role
-- Arquivo: supabase/proposals/20261112_escalada.sql
--
-- SOMENTE PROPOSTA. Nada aqui foi executado.
-- Quem executa e o Rafael, no SQL Editor do Supabase, bloco por bloco.
--
-- Tabelas afetadas (somente estas 4, todas do schema public):
--   public.profiles, public.convites, public.permissoes_convite,
--   public.permissoes_usuario
--
-- Estado final desejado:
--   profiles           : authenticated somente SELECT do proprio registro
--                        (admin le todos pela policy de admin, TO authenticated).
--                        Sem INSERT, UPDATE ou DELETE. Anon sem nenhum privilegio.
--   convites           : anon e authenticated sem nenhum privilegio.
--   permissoes_convite : anon e authenticated sem nenhum privilegio.
--                        As duas ficam com RLS ligada e SEM policy (nega tudo).
--                        Somente o service_role acessa.
--   permissoes_usuario : authenticated somente SELECT das proprias
--                        (admin le todas pela policy de admin, TO authenticated).
--                        Anon sem nenhum privilegio.
--   service_role       : SELECT, INSERT, UPDATE, DELETE nas 4 (e o que o app usa,
--                        sempre pelo supabaseAdmin). Sem TRUNCATE, REFERENCES nem
--                        TRIGGER para anon, authenticated e service_role.
--
-- Por que o app nao quebra: nenhum componente ou rota acessa estas 4 tabelas
-- pelo cliente do usuario. Todas as leituras e gravacoes passam por server
-- functions com o supabaseAdmin (service_role), que ignora a RLS.
--
-- Escopo: somente o schema public. Nao toca em consultorio, auth, storage
-- nem em outras tabelas do public.
--
-- Ordem dos blocos:
--   A) ESTADO ANTERIOR (inclui A.0, trava de seguranca)
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

-- A.0) TRAVA DE SEGURANCA. Rode A.0a e A.0b ANTES de qualquer outra coisa.
--
--   Se aparecer qualquer tabela que nao seja da Gestao, ou colunas em
--   profiles que o codigo da Gestao nao usa, PARE: pode ser de outro
--   sistema (LabConect) e este script nao deve ser executado.
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
--   Colunas de public.profiles que o codigo da Gestao usa (exatamente 7):
--     id, nome, email, role, status, convite_token, criado_em

-- A.0a) Todas as tabelas do schema public (somente nomes).
--       Esperado: somente nomes da lista acima.
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- A.0b) Colunas de public.profiles.
--       Esperado: exatamente as 7 colunas listadas acima.
select ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;

-- A.1) RLS das 4 tabelas e existencia de public.is_admin(uuid).
--      Esperado: 4 linhas com rls_ligada = true; is_admin_existe = true.
select
  c.relname            as tabela,
  c.relrowsecurity     as rls_ligada,
  c.relforcerowsecurity as rls_forcada,
  pg_get_userbyid(c.relowner) as dono,
  to_regprocedure('public.is_admin(uuid)') is not null as is_admin_existe
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
order by c.relname;

-- A.2) Policies atuais das 4 tabelas (pg_policies).
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
order by tablename, policyname;

-- A.3) Grants atuais das 4 tabelas, lidos direto da ACL (exato, inclui
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
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
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
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
order by 1, 2, 3, 4;

-- A.4) SQL DE REVERSAO EXATA, gerado a partir do estado atual do banco.
--      Resultado: 1 linha com um texto grande. COPIE e GUARDE esse texto
--      (por exemplo, num arquivo local). Ele recria exatamente a RLS, os
--      grants (tabela e coluna) e as policies de hoje. E usado no bloco F.
with alvo(nome) as (
  values ('profiles'), ('convites'), ('permissoes_convite'), ('permissoes_usuario')
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
--      linhas). Anote o resultado. Ele deve ser IDENTICO ao do bloco C.5.
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
-- B) MUDANCA
--    Rode somente se A.0a e A.0b estiverem conforme o esperado e se
--    A.1 mostrar is_admin_existe = true. Selecione do begin ao commit e
--    rode de uma vez. Se qualquer comando falhar, nada e aplicado.
-- =====================================================================

begin;

-- B.0) Trava: as 4 tabelas e public.is_admin(uuid) precisam existir.
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.convites') is null
     or to_regclass('public.permissoes_convite') is null
     or to_regclass('public.permissoes_usuario') is null then
    raise exception 'Alguma das 4 tabelas nao existe. Abortando.';
  end if;
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'public.is_admin(uuid) nao existe. Abortando.';
  end if;
end;
$$;

-- B.1) Apaga TODAS as policies atuais das 4 tabelas (os nomes no banco
--      podem divergir dos arquivos, por isso o laco).
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- B.2) RLS ligada nas 4 (idempotente).
alter table public.profiles           enable row level security;
alter table public.convites           enable row level security;
alter table public.permissoes_convite enable row level security;
alter table public.permissoes_usuario enable row level security;

-- B.3) Revoga tudo (tabela e colunas) de public, anon, authenticated e
--      service_role. Inclui TRUNCATE, REFERENCES e TRIGGER.
revoke all on table public.profiles           from public, anon, authenticated, service_role;
revoke all on table public.convites           from public, anon, authenticated, service_role;
revoke all on table public.permissoes_convite from public, anon, authenticated, service_role;
revoke all on table public.permissoes_usuario from public, anon, authenticated, service_role;

-- B.4) Concede de volta somente o necessario.
--      service_role: o que o app usa (supabaseAdmin).
grant select, insert, update, delete on table public.profiles           to service_role;
grant select, insert, update, delete on table public.convites           to service_role;
grant select, insert, update, delete on table public.permissoes_convite to service_role;
grant select, insert, update, delete on table public.permissoes_usuario to service_role;

--      authenticated: somente leitura em profiles e permissoes_usuario
--      (filtrada pela RLS). Nada em convites e permissoes_convite.
--      anon: nada em nenhuma das 4.
grant select on table public.profiles           to authenticated;
grant select on table public.permissoes_usuario to authenticated;

-- B.5) Policies novas.
--      convites e permissoes_convite: nenhuma policy (RLS nega tudo).

-- profiles
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can manage all profiles"
  on public.profiles
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
-- Observacao: como o authenticated so tem SELECT, na pratica esta policy
-- permite ao admin somente LER todos os perfis pelo cliente. Gravacoes
-- continuam pelo service_role.

-- permissoes_usuario
create policy "Users can view their own permissions"
  on public.permissoes_usuario
  for select
  to authenticated
  using (usuario_id = auth.uid());

create policy "Admins can do everything on permissoes_usuario"
  on public.permissoes_usuario
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
-- Mesma observacao: so SELECT tem efeito para o authenticated.

commit;


-- =====================================================================
-- C) VERIFICACAO
-- =====================================================================

-- C.1) RLS. Esperado: 4 linhas, rls_ligada = true.
select c.relname as tabela, c.relrowsecurity as rls_ligada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
order by c.relname;

-- C.2) Policies. Esperado: exatamente 4 linhas, todas com roles = {authenticated}:
--   permissoes_usuario | Admins can do everything on permissoes_usuario | ALL    | is_admin(auth.uid())
--   permissoes_usuario | Users can view their own permissions           | SELECT | (usuario_id = auth.uid())
--   profiles           | Admins can manage all profiles                 | ALL    | is_admin(auth.uid())
--   profiles           | Users can read own profile                     | SELECT | (auth.uid() = id)
--   Nenhuma linha para convites nem permissoes_convite.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
order by tablename, policyname;

-- C.3) Grants (ACL, dono fora). Esperado:
--   convites           | service_role  | DELETE, INSERT, SELECT, UPDATE
--   permissoes_convite | service_role  | DELETE, INSERT, SELECT, UPDATE
--   permissoes_usuario | authenticated | SELECT
--   permissoes_usuario | service_role  | DELETE, INSERT, SELECT, UPDATE
--   profiles           | authenticated | SELECT
--   profiles           | service_role  | DELETE, INSERT, SELECT, UPDATE
--   Se anon, PUBLIC, TRUNCATE, REFERENCES ou TRIGGER aparecerem para
--   anon/authenticated/service_role, PARE e avise: pode ser grant feito por
--   outro grantor (ex.: supabase_admin), que o revoke do postgres nao remove.
--   Outros papeis internos do Supabase, se aparecerem, nao foram tocados.
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
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
  and a.grantee <> c.relowner
group by c.relname, a.grantee, a.grantor
order by c.relname, 2;

-- C.3b) Prova direta com has_table_privilege. Esperado:
--   anon: tudo false nas 4 tabelas.
--   authenticated: somente sel = true em profiles e permissoes_usuario;
--                  todo o resto false.
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
from (values ('anon'), ('authenticated')) as r(papel)
cross join (values ('profiles'), ('convites'), ('permissoes_convite'), ('permissoes_usuario')) as t(tabela)
order by r.papel, t.tabela;

-- C.3c) Grants por coluna para anon/authenticated. Esperado: 0 linhas.
select c.relname as tabela, att.attname as coluna,
       pg_get_userbyid(a.grantee) as grantee, a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
cross join lateral aclexplode(att.attacl) a
where n.nspname = 'public'
  and c.relname in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
  and pg_get_userbyid(a.grantee) in ('anon', 'authenticated');

-- C.4) Tabelas do public de novo. Esperado: identico ao A.0a.
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- C.5) Foto estrutural do consultorio DE NOVO.
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


-- =====================================================================
-- D) MEDICAO
--    Roda dentro de begin/rollback: nao deixa rastro.
--    Selecione o bloco inteiro (do begin ao rollback) e rode de uma vez.
--    Rode ANTES da mudanca (bloco B) e DEPOIS dela. Antes, varios itens
--    devem dar FALHOU (e o problema que estamos fechando). Depois, todos
--    devem dar OK.
--
--    Sobre o colaborador simulado (itens 8 a 12):
--      public.profiles.id tem FK para auth.users. Para nao tocar em
--      auth.users, o perfil de teste e inserido com
--      session_replication_role = replica SOMENTE durante esse insert
--      (desliga a checagem da FK nesta sessao, nesta transacao) e volta
--      para origin logo em seguida. O perfil some no rollback.
--      Se o Supabase recusar esse ajuste, o item 8 mostra
--      "NAO EXECUTADO" e os itens 9 a 12 ficam sem teste: nesse caso,
--      avise antes de seguir.
--
--    Esperado DEPOIS do bloco B:
--       1 | anon: select profiles                         | OK: erro de permissao ...
--       2 | anon: select convites                         | OK: erro de permissao ...
--       3 | authenticated comum: is_admin                 | OK: false
--       4 | authenticated comum: insert convite           | OK: erro de permissao ...
--       5 | authenticated comum: select convites          | OK: erro de permissao ...
--       6 | authenticated comum: profiles de outros       | OK: 0 visiveis (existem N)
--       7 | authenticated comum: insert permissoes_usuario| OK: erro de permissao ...
--       8 | colaborador: perfil de teste inserido         | OK: inserido (some no rollback)
--       9 | colaborador: is_admin                         | OK: false
--      10 | colaborador: le o proprio perfil              | OK: proprio = 1, total visivel = 1
--      11 | colaborador: update do proprio role           | OK: erro de permissao ...
--      12 | colaborador: role depois da tentativa         | OK: colaborador
-- =====================================================================

begin;

create temp table _medicao_escalada (
  ordem     int,
  teste     text,
  resultado text
) on commit drop;

do $$
declare
  v_sub      uuid := gen_random_uuid();  -- authenticated comum, sem perfil
  v_colab    uuid := gen_random_uuid();  -- colaborador simulado
  v_count    bigint;
  v_total    bigint;
  v_outros   bigint;
  v_role     text;
  v_colab_ok boolean := false;
  r1  text; r2  text; r3  text; r4  text; r5  text; r6  text; r7  text;
  r8  text; r9  text; r10 text; r11 text; r12 text;
begin
  -- -------------------------------------------------------------------
  -- anon
  -- -------------------------------------------------------------------

  -- 1) anon: select em profiles deve dar erro de permissao
  begin
    execute 'set local role anon';
    execute 'select count(*) from public.profiles' into v_count;
    execute 'reset role';
    r1 := 'FALHOU: anon leu profiles (' || v_count || ' linhas visiveis)';
  exception
    when insufficient_privilege then r1 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then r1 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 2) anon: select em convites deve dar erro de permissao
  begin
    execute 'set local role anon';
    execute 'select count(*) from public.convites' into v_count;
    execute 'reset role';
    r2 := 'FALHOU: anon leu convites (' || v_count || ' linhas visiveis)';
  exception
    when insufficient_privilege then r2 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then r2 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- -------------------------------------------------------------------
  -- authenticated comum (sub aleatorio, sem perfil)
  -- -------------------------------------------------------------------

  -- quantos perfis existem alem do sub aleatorio (lido como postgres)
  select count(*) into v_outros from public.profiles where id <> v_sub;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_sub, 'role', 'authenticated')::text,
    true
  );

  -- 3) sanidade: o sub aleatorio nao e admin
  r3 := case when public.is_admin(v_sub) then 'FALHOU: true' else 'OK: false' end;

  -- 4) insert em convites deve dar erro de permissao
  begin
    execute 'set local role authenticated';
    execute $ins$
      insert into public.convites (nome, email, token, status)
      values ('Medicao', 'medicao-escalada@invalid.local',
              'medicao-escalada-token', 'pendente')
    $ins$;
    execute 'reset role';
    r4 := 'FALHOU: insert de convite aceito';
  exception
    when insufficient_privilege then r4 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then r4 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 5) select em convites deve dar erro de permissao
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from public.convites' into v_count;
    execute 'reset role';
    r5 := 'FALHOU: authenticated leu convites (' || v_count || ' linhas visiveis)';
  exception
    when insufficient_privilege then r5 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then r5 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 6) profiles de outros: deve ver 0
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from public.profiles where id <> $1' into v_count using v_sub;
    execute 'reset role';
    r6 := case
            when v_outros = 0 then 'INCONCLUSIVO: nao ha outros perfis no banco'
            when v_count = 0  then 'OK: 0 visiveis (existem ' || v_outros || ')'
            else 'FALHOU: ve ' || v_count || ' de ' || v_outros || ' perfis de outros'
          end;
  exception
    when others then r6 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 7) insert em permissoes_usuario deve dar erro de permissao
  begin
    execute 'set local role authenticated';
    execute 'insert into public.permissoes_usuario (usuario_id, area, item_menu) values ($1, $2, $3)'
      using v_sub, 'medicao', 'medicao';
    execute 'reset role';
    r7 := 'FALHOU: insert em permissoes_usuario aceito';
  exception
    when insufficient_privilege then r7 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then r7 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';

  -- -------------------------------------------------------------------
  -- colaborador simulado (perfil inserido aqui, some no rollback)
  -- -------------------------------------------------------------------

  -- 8) insere o perfil de teste como postgres
  begin
    perform set_config('session_replication_role', 'replica', true);
    insert into public.profiles (id, nome, email, role, status, convite_token)
    values (v_colab, 'Medicao Colaborador', 'medicao-colaborador@invalid.local',
            'colaborador', 'ativo', null);
    perform set_config('session_replication_role', 'origin', true);
    v_colab_ok := true;
    r8 := 'OK: inserido (some no rollback)';
  exception
    when others then
      r8 := 'NAO EXECUTADO: ' || sqlstate || ' ' || sqlerrm;
  end;

  if v_colab_ok then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_colab, 'role', 'authenticated')::text,
      true
    );

    -- 9) sanidade: colaborador nao e admin
    r9 := case when public.is_admin(v_colab) then 'FALHOU: true' else 'OK: false' end;

    -- 10) le o proprio perfil, e somente ele
    begin
      execute 'set local role authenticated';
      execute 'select count(*) from public.profiles where id = $1' into v_count using v_colab;
      execute 'select count(*) from public.profiles' into v_total;
      execute 'reset role';
      r10 := case
               when v_count = 1 and v_total = 1 then 'OK: proprio = 1, total visivel = 1'
               else 'FALHOU: proprio = ' || v_count || ', total visivel = ' || v_total
             end;
    exception
      when others then r10 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
    end;

    -- 11) tenta virar admin: deve dar erro de permissao
    begin
      execute 'set local role authenticated';
      execute 'update public.profiles set role = ''admin'' where id = $1' using v_colab;
      get diagnostics v_count = row_count;
      execute 'reset role';
      r11 := 'FALHOU: update aceito (' || v_count || ' linha(s))';
    exception
      when insufficient_privilege then r11 := 'OK: erro de permissao (' || sqlerrm || ')';
      when others then r11 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
    end;

    execute 'reset role';

    -- 12) confere como postgres que o role nao mudou
    select role into v_role from public.profiles where id = v_colab;
    r12 := case when v_role = 'colaborador' then 'OK: colaborador'
                else 'FALHOU: role = ' || coalesce(v_role, 'null') end;
  else
    r9 := 'NAO EXECUTADO (ver item 8)';
    r10 := r9; r11 := r9; r12 := r9;
  end if;

  execute 'reset role';

  insert into _medicao_escalada values
    ( 1, 'anon: select profiles',                          r1),
    ( 2, 'anon: select convites',                          r2),
    ( 3, 'authenticated comum: is_admin',                  r3),
    ( 4, 'authenticated comum: insert convite',            r4),
    ( 5, 'authenticated comum: select convites',           r5),
    ( 6, 'authenticated comum: profiles de outros',        r6),
    ( 7, 'authenticated comum: insert permissoes_usuario', r7),
    ( 8, 'colaborador: perfil de teste inserido',          r8),
    ( 9, 'colaborador: is_admin',                          r9),
    (10, 'colaborador: le o proprio perfil',               r10),
    (11, 'colaborador: update do proprio role',            r11),
    (12, 'colaborador: role depois da tentativa',          r12);

  raise notice '1) %', r1;   raise notice '2) %', r2;
  raise notice '3) %', r3;   raise notice '4) %', r4;
  raise notice '5) %', r5;   raise notice '6) %', r6;
  raise notice '7) %', r7;   raise notice '8) %', r8;
  raise notice '9) %', r9; raise notice '10) %', r10;
  raise notice '11) %', r11; raise notice '12) %', r12;
end;
$$;

select ordem, teste, resultado
from _medicao_escalada
order by ordem;

rollback;

-- Conferencia de que a medicao nao deixou rastro. Esperado: 0 e 0.
-- select
--   (select count(*) from public.profiles
--     where email = 'medicao-colaborador@invalid.local') as perfis_teste,
--   (select count(*) from public.convites
--     where token = 'medicao-escalada-token')            as convites_teste;


-- =====================================================================
-- E) TESTE NO APP (manual, sem SQL)
--    Depois do bloco B, com o PR #8 (requireSupabaseAuth + exigirAdmin)
--    ja em producao:
--    1. Entrar no app de producao com a conta Google do Rafael (admin).
--       O menu lateral e o topo devem carregar normalmente.
--    2. Abrir a gestao de usuarios: a lista de usuarios e de convites
--       pendentes deve aparecer.
--    3. Criar um convite de teste para um e-mail seu secundario, com
--       uma permissao qualquer. Depois, apagar esse convite.
--    4. Abrir e salvar as permissoes de um usuario existente sem mudar nada.
--    5. Abrir o app numa janela anonima, sem login: nada de usuarios ou
--       convites deve aparecer.
--    Se algo falhar, rodar o bloco F e avisar.
-- =====================================================================


-- =====================================================================
-- F) REVERSAO (toda comentada; descomente somente se for desfazer)
--
--    ATENCAO: os arquivos do repositorio divergem do banco. O modelo
--    abaixo foi montado a partir dos arquivos (supabase/migrations e
--    schema_completo.sql) e serve SOMENTE COMO MODELO. Antes de qualquer
--    uso, ele deve ser conferido contra o resultado REAL do bloco A
--    (A.1, A.2, A.3, A.3b).
--
--    Caminho recomendado (reversao exata):
--      F.1 apaga as policies criadas no bloco B;
--      F.2 cola o texto gerado em A.4, que recria exatamente a RLS, os
--          grants e as policies que existiam antes.
--    Use o modelo F.3 somente se nao tiver guardado o resultado de A.4,
--    e ajuste-o para bater com A.2 e A.3.
--
--    Lembrete: reverter REABRE a escalada de privilegio.
-- =====================================================================

-- begin;
--
-- -- F.1) apaga todas as policies atuais das 4 tabelas
-- do $$
-- declare
--   p record;
-- begin
--   for p in
--     select tablename, policyname
--     from pg_policies
--     where schemaname = 'public'
--       and tablename in ('profiles', 'convites', 'permissoes_convite', 'permissoes_usuario')
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
--
-- alter table public.profiles           enable row level security;
-- alter table public.convites           enable row level security;
-- alter table public.permissoes_convite enable row level security;
-- alter table public.permissoes_usuario enable row level security;
--
-- revoke all on table public.profiles           from public, anon, authenticated, service_role;
-- revoke all on table public.convites           from public, anon, authenticated, service_role;
-- revoke all on table public.permissoes_convite from public, anon, authenticated, service_role;
-- revoke all on table public.permissoes_usuario from public, anon, authenticated, service_role;
--
-- -- profiles
-- grant select on table public.profiles to anon;
-- grant select, insert, update, delete on table public.profiles to authenticated;
-- grant all on table public.profiles to service_role;
-- create policy "Users can read own profile" on public.profiles
--   for select to authenticated using (auth.uid() = id);
-- create policy "Users can update own profile" on public.profiles
--   for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- create policy "Admins can manage all profiles" on public.profiles
--   for all using (public.is_admin(auth.uid()));
--
-- -- convites
-- grant select on table public.convites to anon;
-- grant select, insert, update, delete on table public.convites to authenticated;
-- grant all on table public.convites to service_role;
-- create policy "Anyone can read invites by token" on public.convites
--   for select using (true);
-- create policy "Authenticated can insert invites" on public.convites
--   for insert to authenticated with check (true);
-- create policy "Authenticated can update invites" on public.convites
--   for update to authenticated using (true) with check (true);
-- create policy "Authenticated can delete invites" on public.convites
--   for delete to authenticated using (true);
--
-- -- permissoes_convite
-- grant select, insert, update, delete on table public.permissoes_convite to authenticated;
-- grant all on table public.permissoes_convite to service_role;
-- create policy "Authenticated can manage invite permissions" on public.permissoes_convite
--   for all to authenticated using (true) with check (true);
--
-- -- permissoes_usuario
-- grant select, insert, update, delete on table public.permissoes_usuario to authenticated;
-- grant all on table public.permissoes_usuario to service_role;
-- create policy "Admins can do everything on permissoes_usuario" on public.permissoes_usuario
--   for all using (public.is_admin(auth.uid()));
-- create policy "Users can view their own permissions" on public.permissoes_usuario
--   for select to authenticated using (usuario_id = auth.uid());
--
-- commit;
--
-- Conferencia apos a reversao: rode A.2, A.3 e A.3b de novo. O resultado
-- deve ser IDENTICO ao guardado antes do bloco B. E a foto do consultorio
-- (A.5) deve continuar igual.
