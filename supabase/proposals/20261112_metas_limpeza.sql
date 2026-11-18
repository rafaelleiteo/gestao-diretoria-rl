-- =====================================================================
-- PROPOSTA: limpa as 3 metas de teste, tira o Daniel da Gestao e corrige
--           o trigger de public.metas (passa a rodar tambem em INSERT).
-- Arquivo: supabase/proposals/20261112_metas_limpeza.sql
-- Reversao: supabase/proposals/20261112_metas_limpeza_reversao.sql
--
-- SOMENTE PROPOSTA. Nada aqui foi executado no Supabase.
-- Quem executa e o Rafael, no SQL Editor do Supabase, bloco por bloco.
--
-- Contexto: a Gestao e de uso exclusivo do Rafael. O Daniel (socio do
-- LabConect) nunca participa da Gestao. Por isso:
--   - responsaveis passa a aceitar somente 'Rafael', 'Terceiro' e
--     'Indefinido' (e recusa elemento nulo de forma explicita);
--   - origem_discussao passa a aceitar somente 'sugestao_rafael' (ou null).
--
-- Escopo: somente a tabela public.metas e a funcao
-- public.metas_before_update. NAO mexe em RLS, policy, grants nem no
-- indice unico. Nao toca em consultorio, auth (o bloco D apenas LE
-- auth.users), storage nem em outras tabelas.
--
-- Pre-requisito: o PR "fix(metas): tira o Daniel da Gestao e torna a
-- importacao segura" com merge e publicado em producao. Sem ele, a tela
-- ainda oferece 'Daniel' e as origens antigas, e o banco recusaria.
--
-- ORDEM DE EXECUCAO
--   A) ESTADO ANTERIOR (somente leitura). Rode cada consulta separadamente
--      e SALVE o resultado de todas (copie para um arquivo seu). Em
--      especial: A.2 (as 3 linhas), A.3 (checks antigos), A.4 (funcao e
--      trigger antigos), A.5 (foto do consultorio) e A.7 (medicao antes).
--      Esperado em A.1: 3 linhas, todas com fonte = 'teste'.
--      Esperado em A.6: 0.
--      Se A.1 ou A.6 nao baterem, PARE: o bloco B vai abortar de qualquer
--      jeito, mas e melhor entender o motivo antes.
--   B) MUDANCA. Selecione do "begin;" ao "commit;" e rode DE UMA VEZ.
--      E uma unica transacao: ou tudo e gravado, ou nada. As travas (B.1)
--      e os testes (B.8) abortam com erro se algo nao bater.
--      Se aparecer QUALQUER erro: rode "rollback;" sozinho. Nada ficou
--      gravado; confira com A.1 (deve continuar igual).
--      Se der certo, as mensagens (NOTICE) mostram cada teste com OK.
--   C) VERIFICACAO (somente leitura). Rode cada consulta separadamente.
--      C.5 deve ser IDENTICA a A.5.
--   D) MEDICAO DEPOIS. Mesmo bloco de A.7, em begin/rollback (sem rastro).
--      O resultado deve ser igual ao de A.7: tudo OK.
--   F) Reversao: no arquivo separado, toda comentada.
--
-- Dica: o SQL Editor mostra somente o resultado do ultimo comando.
-- Rode cada consulta de leitura separadamente (selecione e rode).
-- =====================================================================


-- =====================================================================
-- A) ESTADO ANTERIOR (somente leitura; rodar e SALVAR cada resultado)
-- =====================================================================

-- A.1) Contagem por fonte e total.
--      Esperado hoje: 1 linha, fonte = teste, linhas = 3, total = 3.
select fonte, count(*) as linhas, sum(count(*)) over () as total
from public.metas
group by fonte
order by fonte;

-- A.2) As 3 linhas de teste, completas. SALVE este resultado.
--      Esperado: 3 linhas (Meta teste 1, 2 e 3).
select to_jsonb(m) as linha
from public.metas m
where m.fonte = 'teste'
order by m.titulo;

-- A.3) Checks atuais de responsaveis e origem_discussao. SALVE.
--      Esperado: responsaveis com 'Daniel' e origem com 3 opcoes.
select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.metas'::regclass
  and conname in ('metas_responsaveis_check', 'metas_origem_discussao_check')
order by conname;

-- A.4a) Funcao atual do trigger. SALVE.
select pg_get_functiondef('public.metas_before_update()'::regprocedure) as funcao;

-- A.4b) Trigger atual. SALVE. Esperado hoje: BEFORE UPDATE (sem INSERT).
select t.tgname as trigger, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
where t.tgrelid = 'public.metas'::regclass
  and not t.tgisinternal;

-- A.5) Foto estrutural do schema consultorio (somente leitura, sem contar
--      linhas). SALVE. Deve ser IDENTICA ao resultado do bloco C.5.
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

-- A.6) Linhas FORA das 3 de teste que usam Daniel ou as origens antigas.
--      Esperado: 0. Se vier maior que 0, PARE e avise: o bloco B abortaria
--      (o check novo recusaria essas linhas).
select count(*) as linhas_com_daniel_fora_do_teste
from public.metas
where id not in (
        '90e8a037-59a4-455a-87ce-db10d7c3a1f6',
        '7f0c2329-da42-42d3-bdf7-8501424ceb51',
        'b5358702-2331-47f6-a75e-b6e1bb575d86'
      )
  and (   'Daniel' = any (responsaveis)
       or origem_discussao in ('sugestao_daniel', 'discutido_ambos'));

-- A.7) MEDICAO ANTES. Mesmo bloco do D (copiado abaixo, identico).
--      Selecione do "begin;" ao "rollback;" e rode de uma vez. SALVE.
--      Esperado:
--        0 | origem do sub usado                          | (informativo)
--        1 | anon: select                                 | OK: erro de permissao ...
--        2 | outro usuario (nao admin): select            | OK: count = 0
--        3 | outro usuario (nao admin): insert            | OK: bloqueado pela RLS ...
--        4 | sanidade: is_admin do sub usado              | OK: false

begin;

create temp table _medicao_metas (
  ordem     int,
  teste     text,
  resultado text
) on commit drop;

do $$
declare
  v_sub    uuid;
  v_origem text;
  v_count  bigint;
  v_1      text;
  v_2      text;
  v_3      text;
  v_4      text;
begin
  -- Sub do JWT: um usuario REAL de auth.users que NAO e admin (por exemplo,
  -- alguem que entra so no LabConect ou no consultorio). Somente leitura
  -- em auth.users. Se nao houver nenhum, usa um uuid aleatorio.
  select u.id into v_sub
  from auth.users u
  where not public.is_admin(u.id)
  order by u.created_at
  limit 1;

  if v_sub is null then
    v_sub := gen_random_uuid();
    v_origem := 'uuid aleatorio (nenhum usuario nao admin em auth.users)';
  else
    v_origem := 'usuario existente em auth.users, nao admin (id nao exibido)';
  end if;

  -- 1) anon: select deve dar erro de permissao
  begin
    execute 'set local role anon';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_1 := 'FALHOU: anon conseguiu ler (' || v_count || ' linhas)';
  exception
    when insufficient_privilege then
      v_1 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then
      v_1 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- JWT do outro usuario
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_sub, 'role', 'authenticated')::text,
    true
  );

  -- 2) outro usuario: select count(*) deve dar 0 (a RLS esconde tudo)
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_2 := case when v_count = 0 then 'OK: count = 0'
                else 'FALHOU: count = ' || v_count end;
  exception
    when others then
      v_2 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 3) outro usuario: insert deve ser bloqueado pela RLS (valores validos
  --    nos checks antigos e novos, para o bloqueio vir somente da policy)
  begin
    execute 'set local role authenticated';
    execute $ins$
      insert into public.metas
        (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade, fonte)
      values
        ('versa3d', 'tarefa', 'Medicao RLS', 'medicao rls', 'Versa3D', 'depois', 'medicao')
    $ins$;
    execute 'reset role';
    v_3 := 'FALHOU: insert aceito';
  exception
    when insufficient_privilege then
      v_3 := 'OK: bloqueado pela RLS (' || sqlerrm || ')';
    when others then
      v_3 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';

  -- 4) sanidade: o sub usado nao e admin
  v_4 := case when public.is_admin(v_sub) then 'FALHOU: true' else 'OK: false' end;

  insert into _medicao_metas values
    (0, 'origem do sub usado',               v_origem),
    (1, 'anon: select',                      v_1),
    (2, 'outro usuario (nao admin): select', v_2),
    (3, 'outro usuario (nao admin): insert', v_3),
    (4, 'sanidade: is_admin do sub usado',   v_4);

  raise notice '0) origem do sub: %', v_origem;
  raise notice '1) anon select: %', v_1;
  raise notice '2) outro usuario select: %', v_2;
  raise notice '3) outro usuario insert: %', v_3;
  raise notice '4) is_admin do sub: %', v_4;
end;
$$;

select ordem, teste, resultado
from _medicao_metas
order by ordem;

rollback;


-- =====================================================================
-- B) MUDANCA: UMA transacao, tudo ou nada.
--    Selecione do "begin;" ao "commit;" e rode de uma vez.
--    Se aparecer erro, rode "rollback;" sozinho. Nada fica gravado.
-- =====================================================================

begin;

-- B.0) Trava a tabela durante a transacao (bloqueia leituras e escritas
--      do app por um instante; o ALTER TABLE precisaria disso de qualquer
--      jeito). Evita que algo mude entre a conferencia e o delete.
lock table public.metas in access exclusive mode;

-- B.1) TRAVA: aborta se as linhas de teste nao forem exatamente as 3
--      esperadas, ou se a tabela tiver qualquer outra linha.
do $$
declare
  v_esperados uuid[] := array[
    '90e8a037-59a4-455a-87ce-db10d7c3a1f6',
    '7f0c2329-da42-42d3-bdf7-8501424ceb51',
    'b5358702-2331-47f6-a75e-b6e1bb575d86'
  ]::uuid[];
  v_ids   uuid[];
  v_total bigint;
begin
  select coalesce(array_agg(t.id order by t.id), '{}'::uuid[])
    into v_ids
  from (
    select id
    from public.metas
    where fonte = 'teste'
    for update
  ) t;

  -- (i) exatamente 3 linhas com fonte = 'teste'
  if cardinality(v_ids) <> 3 then
    raise exception 'TRAVA B.1 (i): esperado 3 linhas com fonte = teste, encontrado %. Nada foi alterado.',
      cardinality(v_ids);
  end if;

  -- (ii) os ids sao exatamente os 3 esperados
  if v_ids <> (select array_agg(x order by x) from unnest(v_esperados) x) then
    raise exception 'TRAVA B.1 (ii): os ids com fonte = teste nao sao os 3 esperados (%). Nada foi alterado.',
      v_ids;
  end if;

  -- (iii) a tabela so tem essas 3 linhas (o teste B.8 exige total 0 no fim)
  select count(*) into v_total from public.metas;
  if v_total <> 3 then
    raise exception 'TRAVA B.1 (iii): public.metas tem % linhas; esperado 3 (somente as de teste). Nada foi alterado.',
      v_total;
  end if;

  raise notice 'B.1 OK: exatamente as 3 linhas de teste esperadas, e nenhuma outra';
end;
$$;

-- B.2) Apaga somente as 3 linhas de teste (fonte E id).
delete from public.metas
where fonte = 'teste'
  and id in (
    '90e8a037-59a4-455a-87ce-db10d7c3a1f6',
    '7f0c2329-da42-42d3-bdf7-8501424ceb51',
    'b5358702-2331-47f6-a75e-b6e1bb575d86'
  );

do $$
begin
  if (select count(*) from public.metas) <> 0 then
    raise exception 'B.2 FALHOU: public.metas nao ficou vazia apos o delete';
  end if;
  raise notice 'B.2 OK: 3 linhas de teste apagadas, tabela vazia';
end;
$$;

-- B.3) responsaveis: somente Rafael, Terceiro e Indefinido, e nenhum
--      elemento nulo (trava explicita com array_position, que encontra
--      null; nao depende do comportamento do <@ com null).
alter table public.metas drop constraint metas_responsaveis_check;
alter table public.metas add constraint metas_responsaveis_check
  check (
        responsaveis <@ array['Rafael', 'Terceiro', 'Indefinido']::text[]
    and array_position(responsaveis, null) is null
  );

-- B.4) origem_discussao: somente 'sugestao_rafael' (null continua aceito).
alter table public.metas drop constraint metas_origem_discussao_check;
alter table public.metas add constraint metas_origem_discussao_check
  check (origem_discussao is null or origem_discussao = 'sugestao_rafael');

-- B.5) Funcao do trigger, agora para INSERT e UPDATE (usa tg_op, porque
--      OLD nao existe em INSERT). Mesmo nome, sem security definer.
--   sempre                        -> atualizado_em = now()
--   INSERT, status 'concluido'    -> concluido_em = valor enviado, ou now()
--   INSERT, outro status          -> concluido_em = null
--   UPDATE, passa a 'concluido'   -> concluido_em = now()
--   UPDATE, continua 'concluido'  -> mantem concluido_em (preenche se vazio)
--   UPDATE, outro status          -> concluido_em = null
create or replace function public.metas_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();

  if tg_op = 'INSERT' then
    if new.status = 'concluido' then
      new.concluido_em := coalesce(new.concluido_em, now());
    else
      new.concluido_em := null;
    end if;
  else
    if new.status = 'concluido' then
      if old.status is distinct from 'concluido' or new.concluido_em is null then
        new.concluido_em := now();
      end if;
    else
      new.concluido_em := null;
    end if;
  end if;

  return new;
end;
$$;

-- B.6) Trigger com o mesmo nome, agora BEFORE INSERT OR UPDATE.
drop trigger if exists metas_before_update on public.metas;
create trigger metas_before_update
  before insert or update on public.metas
  for each row
  execute function public.metas_before_update();

-- B.7) RLS, policy, grants e indice unico: NADA muda aqui.

-- B.8) Testes funcionais dentro da mesma transacao. Qualquer falha da
--      raise exception e aborta TUDO (inclusive o delete do B.2).
--      Linhas com fonte = 'medicao_tmp', apagadas no fim deste bloco.
--      Obs.: now() e fixo dentro da transacao, por isso a comparacao exata.
do $$
declare
  v_id uuid;
  v_c  timestamptz;
  v_a  timestamptz;
  v_ok boolean;
begin
  -- T1) insert concluido com concluido_em explicito mantem a data
  insert into public.metas
    (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
     status, concluido_em, fonte)
  values
    ('versa3d', 'tarefa', 'Medicao T1', 'medicao t1', 'Versa3D', 'depois',
     'concluido', '2026-01-15', 'medicao_tmp')
  returning concluido_em into v_c;
  if v_c is distinct from '2026-01-15'::timestamptz then
    raise exception 'B.8 T1 FALHOU: concluido_em = % (esperado 2026-01-15)', v_c;
  end if;
  raise notice 'B.8 T1 OK: insert concluido com data explicita manteve %', v_c;

  -- T2) insert concluido sem concluido_em recebe now()
  insert into public.metas
    (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
     status, fonte)
  values
    ('versa3d', 'tarefa', 'Medicao T2', 'medicao t2', 'Versa3D', 'depois',
     'concluido', 'medicao_tmp')
  returning concluido_em into v_c;
  if v_c is distinct from now() then
    raise exception 'B.8 T2 FALHOU: concluido_em = % (esperado now())', v_c;
  end if;
  raise notice 'B.8 T2 OK: insert concluido sem data recebeu now()';

  -- T3) insert nao concluido com concluido_em preenchido fica null
  insert into public.metas
    (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
     status, concluido_em, fonte)
  values
    ('versa3d', 'tarefa', 'Medicao T3', 'medicao t3', 'Versa3D', 'depois',
     'a_fazer', '2026-01-15', 'medicao_tmp')
  returning concluido_em into v_c;
  if v_c is not null then
    raise exception 'B.8 T3 FALHOU: concluido_em = % (esperado null)', v_c;
  end if;
  raise notice 'B.8 T3 OK: insert a_fazer com data ficou com concluido_em null';

  -- T4) update para concluido preenche; update de volta para a_fazer zera
  insert into public.metas
    (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
     status, fonte)
  values
    ('versa3d', 'tarefa', 'Medicao T4', 'medicao t4', 'Versa3D', 'depois',
     'a_fazer', 'medicao_tmp')
  returning id into v_id;

  update public.metas set status = 'concluido' where id = v_id
  returning concluido_em, atualizado_em into v_c, v_a;
  if v_c is distinct from now() or v_a is distinct from now() then
    raise exception 'B.8 T4a FALHOU: concluido_em = %, atualizado_em = %', v_c, v_a;
  end if;

  update public.metas set status = 'a_fazer' where id = v_id
  returning concluido_em into v_c;
  if v_c is not null then
    raise exception 'B.8 T4b FALHOU: concluido_em = % (esperado null)', v_c;
  end if;
  raise notice 'B.8 T4 OK: update para concluido preencheu, volta para a_fazer zerou';

  -- T5) responsaveis {Daniel} e recusado
  v_ok := false;
  begin
    insert into public.metas
      (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
       responsaveis, fonte)
    values
      ('versa3d', 'tarefa', 'Medicao T5', 'medicao t5', 'Versa3D', 'depois',
       array['Daniel']::text[], 'medicao_tmp');
  exception
    when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'B.8 T5 FALHOU: responsaveis {Daniel} foi aceito';
  end if;
  raise notice 'B.8 T5 OK: {Daniel} recusado (check_violation)';

  -- T6) array[null]::text[] e recusado
  v_ok := false;
  begin
    insert into public.metas
      (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
       responsaveis, fonte)
    values
      ('versa3d', 'tarefa', 'Medicao T6', 'medicao t6', 'Versa3D', 'depois',
       array[null]::text[], 'medicao_tmp');
  exception
    when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'B.8 T6 FALHOU: responsaveis {NULL} foi aceito';
  end if;

  -- T6b) {Rafael, NULL} tambem e recusado
  v_ok := false;
  begin
    insert into public.metas
      (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
       responsaveis, fonte)
    values
      ('versa3d', 'tarefa', 'Medicao T6b', 'medicao t6b', 'Versa3D', 'depois',
       array['Rafael', null]::text[], 'medicao_tmp');
  exception
    when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'B.8 T6b FALHOU: responsaveis {Rafael,NULL} foi aceito';
  end if;
  raise notice 'B.8 T6 OK: elemento nulo em responsaveis recusado';

  -- T7) origem_discussao 'sugestao_daniel' e recusada
  v_ok := false;
  begin
    insert into public.metas
      (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
       origem_discussao, fonte)
    values
      ('versa3d', 'tarefa', 'Medicao T7', 'medicao t7', 'Versa3D', 'depois',
       'sugestao_daniel', 'medicao_tmp');
  exception
    when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'B.8 T7 FALHOU: origem sugestao_daniel foi aceita';
  end if;

  -- T7b) origem_discussao 'discutido_ambos' tambem e recusada
  v_ok := false;
  begin
    insert into public.metas
      (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
       origem_discussao, fonte)
    values
      ('versa3d', 'tarefa', 'Medicao T7b', 'medicao t7b', 'Versa3D', 'depois',
       'discutido_ambos', 'medicao_tmp');
  exception
    when check_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'B.8 T7b FALHOU: origem discutido_ambos foi aceita';
  end if;
  raise notice 'B.8 T7 OK: origens do Daniel recusadas';

  -- T8) {Rafael, Terceiro} com origem 'sugestao_rafael' e aceito
  insert into public.metas
    (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade,
     responsaveis, nome_terceiro, origem_discussao, fonte)
  values
    ('versa3d', 'tarefa', 'Medicao T8', 'medicao t8', 'Versa3D', 'depois',
     array['Rafael', 'Terceiro']::text[], 'Fornecedor', 'sugestao_rafael',
     'medicao_tmp');
  raise notice 'B.8 T8 OK: {Rafael,Terceiro} com sugestao_rafael aceito';

  -- Limpeza das linhas de medicao
  delete from public.metas where fonte = 'medicao_tmp';

  if (select count(*) from public.metas where fonte = 'medicao_tmp') <> 0 then
    raise exception 'B.8 FALHOU: sobraram linhas medicao_tmp';
  end if;
  if (select count(*) from public.metas) <> 0 then
    raise exception 'B.8 FALHOU: public.metas deveria terminar vazia';
  end if;
  raise notice 'B.8 OK: todas as linhas medicao_tmp apagadas, public.metas vazia';
end;
$$;

commit;


-- =====================================================================
-- C) VERIFICACAO (somente leitura, depois do commit)
-- =====================================================================

-- C.1) Checks novos. Esperado:
--   metas_origem_discussao_check:
--     CHECK (((origem_discussao IS NULL) OR (origem_discussao = 'sugestao_rafael'::text)))
--   metas_responsaveis_check:
--     CHECK (((responsaveis <@ ARRAY['Rafael'::text, 'Terceiro'::text, 'Indefinido'::text])
--             AND (array_position(responsaveis, NULL::text) IS NULL)))
select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.metas'::regclass
  and conname in ('metas_responsaveis_check', 'metas_origem_discussao_check')
order by conname;

-- C.2) Funcao nova. Esperado: contem "tg_op = 'INSERT'" e
--      "coalesce(new.concluido_em, now())"; sem SECURITY DEFINER.
select pg_get_functiondef('public.metas_before_update()'::regprocedure) as funcao;

-- C.3) Trigger. Esperado: 1 linha,
--   CREATE TRIGGER metas_before_update BEFORE INSERT OR UPDATE ON public.metas
--   FOR EACH ROW EXECUTE FUNCTION metas_before_update()
select t.tgname as trigger, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
where t.tgrelid = 'public.metas'::regclass
  and not t.tgisinternal;

-- C.4) Tabela vazia. Esperado: 0.
select count(*) as total_metas from public.metas;

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

-- C.6) Policy e grants continuam iguais (conferencia rapida). Esperado:
--      1 policy "Admins can manage metas" (ALL, authenticated, is_admin);
--      authenticated e service_role com DELETE, INSERT, SELECT, UPDATE;
--      anon ausente.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'metas';

select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'metas'
group by grantee
order by grantee;


-- =====================================================================
-- D) MEDICAO DEPOIS (begin/rollback, nao deixa rastro)
--    IDENTICO ao A.7. Selecione do "begin;" ao "rollback;" e rode de uma
--    vez. Resultado esperado: igual ao A.7, tudo OK.
-- =====================================================================

begin;

create temp table _medicao_metas (
  ordem     int,
  teste     text,
  resultado text
) on commit drop;

do $$
declare
  v_sub    uuid;
  v_origem text;
  v_count  bigint;
  v_1      text;
  v_2      text;
  v_3      text;
  v_4      text;
begin
  -- Sub do JWT: um usuario REAL de auth.users que NAO e admin (por exemplo,
  -- alguem que entra so no LabConect ou no consultorio). Somente leitura
  -- em auth.users. Se nao houver nenhum, usa um uuid aleatorio.
  select u.id into v_sub
  from auth.users u
  where not public.is_admin(u.id)
  order by u.created_at
  limit 1;

  if v_sub is null then
    v_sub := gen_random_uuid();
    v_origem := 'uuid aleatorio (nenhum usuario nao admin em auth.users)';
  else
    v_origem := 'usuario existente em auth.users, nao admin (id nao exibido)';
  end if;

  -- 1) anon: select deve dar erro de permissao
  begin
    execute 'set local role anon';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_1 := 'FALHOU: anon conseguiu ler (' || v_count || ' linhas)';
  exception
    when insufficient_privilege then
      v_1 := 'OK: erro de permissao (' || sqlerrm || ')';
    when others then
      v_1 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- JWT do outro usuario
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_sub, 'role', 'authenticated')::text,
    true
  );

  -- 2) outro usuario: select count(*) deve dar 0 (a RLS esconde tudo)
  begin
    execute 'set local role authenticated';
    execute 'select count(*) from public.metas' into v_count;
    execute 'reset role';
    v_2 := case when v_count = 0 then 'OK: count = 0'
                else 'FALHOU: count = ' || v_count end;
  exception
    when others then
      v_2 := 'FALHOU: erro inesperado ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 3) outro usuario: insert deve ser bloqueado pela RLS (valores validos
  --    nos checks antigos e novos, para o bloqueio vir somente da policy)
  begin
    execute 'set local role authenticated';
    execute $ins$
      insert into public.metas
        (area_gestao, tipo, titulo, titulo_normalizado, projeto, prioridade, fonte)
      values
        ('versa3d', 'tarefa', 'Medicao RLS', 'medicao rls', 'Versa3D', 'depois', 'medicao')
    $ins$;
    execute 'reset role';
    v_3 := 'FALHOU: insert aceito';
  exception
    when insufficient_privilege then
      v_3 := 'OK: bloqueado pela RLS (' || sqlerrm || ')';
    when others then
      v_3 := 'FALHOU: erro diferente ' || sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';

  -- 4) sanidade: o sub usado nao e admin
  v_4 := case when public.is_admin(v_sub) then 'FALHOU: true' else 'OK: false' end;

  insert into _medicao_metas values
    (0, 'origem do sub usado',               v_origem),
    (1, 'anon: select',                      v_1),
    (2, 'outro usuario (nao admin): select', v_2),
    (3, 'outro usuario (nao admin): insert', v_3),
    (4, 'sanidade: is_admin do sub usado',   v_4);

  raise notice '0) origem do sub: %', v_origem;
  raise notice '1) anon select: %', v_1;
  raise notice '2) outro usuario select: %', v_2;
  raise notice '3) outro usuario insert: %', v_3;
  raise notice '4) is_admin do sub: %', v_4;
end;
$$;

select ordem, teste, resultado
from _medicao_metas
order by ordem;

rollback;


-- =====================================================================
-- F) REVERSAO
--    Esta no arquivo separado, toda comentada:
--    supabase/proposals/20261112_metas_limpeza_reversao.sql
-- =====================================================================
