# AGENTS.md

Instruções para qualquer agente que trabalhe neste repositório. Leia tudo antes de começar.

## 1. O que é

Hub interno de ideias e tarefas organizado por área, de uso exclusivo do Rafael.

Stack:
- TanStack Start + React + Vite
- Gerenciador de pacotes: npm. O `package-lock.json` é o lock oficial. O `bun.lock` é legado: não mexer nele.
- Banco e autenticação: Supabase
- Hospedagem: Vercel

## 2. Comandos

- `npm run dev`: servidor de desenvolvimento
- `npm run build`: build de produção
- `npm run preview`: pré-visualiza o build
- `npm run lint`: ESLint
- `npm run format`: Prettier

Antes de abrir PR que mexa em código, rodar `npm ci` e `npm run build`. Não afirmar que o lint passa sem rodar.

## 3. Produção

- Vercel, projeto `gestao-diretoria-rl-git` (time `rafael-leite-s-projects`).
- Domínio: https://gestao-diretoria-rl-git.vercel.app
- Publicado automaticamente a partir do `main`.
- Nunca publicar pela CLI da Vercel.

## 4. Regras invioláveis

1. Nunca fazer push no `main`. Sempre usar branch `claude/*`, um tema por PR. Quem faz o merge é o Rafael.
2. Nunca reescrever histórico publicado (force push, rebase, amend ou squash de commits já enviados). Merge de PR sempre por merge commit.
3. Mudanças mínimas, só o que foi pedido.
4. Banco: o Supabase `gestao-plataforma-rafael` é COMPARTILHADO com o sistema do consultório (schema `consultorio`) e o LabConect.
   - Nunca executar SQL.
   - Apenas propor SQL em arquivo, contendo: o estado anterior, o SQL da mudança, o SQL de reversão e uma consulta de medição para rodar antes e depois.
5. Nunca alterar o schema `consultorio`, a tabela `auth.users` ou triggers em `auth.users`. Nunca alterar a Site URL, as Redirect URLs nem o provedor Google do Auth.
6. Nunca commitar arquivos `.env*`, tokens ou chaves.
7. Nunca rodar `populate-rotina.ts`, `migrate-user.ts` ou `insert-inbox-batch.ts`.
8. A pasta `supabase/migrations` é histórico. O Supabase NÃO está ligado ao GitHub, então nada ali é executado automaticamente.
9. Antes de dizer "feito" em algo de banco, mostrar a consulta que prova a mudança.

## 5. Design system: Minimal Mono

- Fundo: `#FFFFFF` e `#FAFAFA`
- Bordas: `#EDEDED`
- Texto: `#111111` (principal) e `#6B7280` (secundário)
- Destaque: `#4F46E5`, com badge em `#EEF0FF`
- Fonte: Inter
- Abas em formato de pílula
- Menu lateral organizado por área

## 6. Comunicação

- Sempre em português.
- Explicar passo a passo.
- Não usar travessão.
