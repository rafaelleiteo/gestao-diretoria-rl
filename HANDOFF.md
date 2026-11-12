# HANDOFF.md

## 1. Estado em 12/11/2026

Fontes: a lista de PRs vem do `git log` do `main`. O que está marcado como "informado pelo Rafael" aconteceu fora do repositório (SQL Editor do Supabase) e não aparece no histórico do git.

### 1.1 Base herdada de 11/11/2026

- Migração para o Claude Code concluída.
- O `main` foi sincronizado com o deploy pela CLI de 27/09 (PR #2, 161 arquivos conferidos por SHA1).
- TanStack Start atualizado para 1.168.61 (CVE-2026-102989).
- Ruleset `protege-main` ativo: PR obrigatório, sem force push, sem deleção, lista de bypass vazia.
- App do Claude no GitHub liberado só para este repositório.
- Produção testada e ok.

### 1.2 PRs mergeados no main desde o PR #3

| PR | Título | Data do merge |
| --- | --- | --- |
| #4 | feat(metas): proposta de SQL da tabela metas | 12/11/2026 |
| #5 | feat(metas): tela de metas na area versa3d com importacao de JSON | 12/11/2026 |
| #6 | fix(seguranca): exige admin no servidor nas funcoes de lancamentos | 12/11/2026 |
| #7 | fix(seguranca): login usa userId e e-mail validados no servidor | 12/11/2026 |
| #9 | proposta(banco): fecha a cadeia de escalada de privilegio | 12/11/2026 |
| #8 | fix(seguranca): exige admin no servidor em usuarios e permissoes | 12/11/2026 |
| #11 | fix(seguranca): exige admin no servidor nos links rapidos | 12/11/2026 |
| #10 | fix(seguranca): exige admin no servidor nas funcoes da rotina | 12/11/2026 |
| #12 | proposta(banco): fecha ao anon as 12 tabelas da Gestao, somente admin | 12/11/2026 |

A tabela está na ordem em que os merges entraram no `main`.

### 1.3 Quadro Metas (PRs #4 e #5)

- Tabela `public.metas`, somente admin. Proposta em `supabase/proposals/20261111_metas.sql`.
- Tela de metas na área versa3d, com importação de JSON (`src/routes/$area.metas.tsx`).
- Informado pelo Rafael: há 3 linhas de teste na tabela (`fonte = 'teste'`) a limpar.

### 1.4 Servidor (PRs #6, #7, #8, #10 e #11)

Login e admin passaram a ser exigidos no servidor em:

- Funções de lançamentos (PR #6).
- Login OAuth: `userId` e e-mail vêm do token, validados no servidor (PR #7).
- Usuários e permissões (PR #8).
- Rotina (PR #10).
- Links rápidos (PR #11).

### 1.5 Banco (PRs #9 e #12)

Os PRs trouxeram apenas as propostas em arquivo. Informado pelo Rafael: os dois arquivos foram executados por ele no SQL Editor e medidos.

- `supabase/proposals/20261112_escalada.sql` (PR #9): `profiles`, `convites`, `permissoes_convite` e `permissoes_usuario`.
- `supabase/proposals/20261112_tabelas_admin.sql` (PR #12): 12 tabelas somente admin, anon sem privilégio.
- A reversão exata de cada um foi salva pelo Rafael fora do repositório.

### 1.6 Regra nova

- Tabela nova nasce com `revoke all` de `anon` e `authenticated`, grant mínimo e policy `is_admin`.
- Toda server function começa com `requireSupabaseAuth` e `exigirAdmin`.

## 2. Pendências resolvidas

Numeração da versão de 11/11/2026 deste arquivo.

1. **Tabelas abertas ao papel anon** (antiga pendência 1): resolvida. Banco no PR #12; servidor nos PRs #6, #10 e #11.
2. **Escalada de privilégio** (antiga pendência 2): resolvida. Banco no PR #9; servidor nos PRs #7 e #8.

## 3. Pendências abertas (para o Rafael priorizar)

1. **Storage**: as policies do bucket `documento-timbre` valem para `public` (anon pode inserir, alterar e apagar). Conferir o resultado do bloco A.7 antes de propor SQL, pois o storage é compartilhado com o consultório.
2. **Endpoints `/api/public/hooks/*`** sem segredo.
3. **Crons**: os lembretes apontam para o domínio `lovable.app`, e o resumo diário das 7h não existe no banco novo.
4. **Legado do Lovable**: verificar se o site e o banco antigos estão ativos e se há dados novos só lá (as contagens das tabelas em 12/11 eram idênticas às da migração de setembro), e desconectar a integração do Lovable com o GitHub (o ruleset já bloqueia push dele no main).
5. **Rotacionar segredos expostos em conversas**: `TELEGRAM_BOT_TOKEN`, `SITE_PASSWORD`, `SESSION_SECRET`.
6. **Supabase Free**: pausa após 7 dias, junto com o consultório.
7. **Metas**:
   - o trigger roda só em UPDATE (meta criada já concluída fica sem `concluido_em`);
   - limpar os dados de teste;
   - importar o levantamento real da Versa3D;
   - tela Pauta de terça.
8. **PermissionsPanel** ainda oferece itens que agora são somente admin (Rotina e as 12 tabelas).
9. **Higiene**: 4 erros antigos de `tsc` em `$area.protocolos.tsx`, erros de lint antigos, Ignored Build Step, `.gitattributes`, `bun.lock`, branches antigas, código morto (login por senha, scripts de teste).

## 4. Lições

- "Feito" de agente sem prova no banco já enganou mais de uma vez.
- O provisório vira permanente.
- O GitHub ficou 27 dias atrás da produção por causa de deploys pela CLI.
