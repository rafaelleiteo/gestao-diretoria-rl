# HANDOFF.md

## 1. Estado em 11/11/2026

- Migração para o Claude Code concluída.
- O `main` foi sincronizado com o deploy pela CLI de 27/09 (PR #2, 161 arquivos conferidos por SHA1).
- TanStack Start atualizado para 1.168.61 (CVE-2026-102989).
- Ruleset `protege-main` ativo: PR obrigatório, sem force push, sem deleção, lista de bypass vazia.
- App do Claude no GitHub liberado só para este repositório.
- Produção testada e ok.

## 2. Pendências (para o Rafael priorizar)

1. **Tabelas abertas ao papel anon**: caixa de entrada, pagamentos recorrentes, prompts, modelos e tarefas recorrentes; convites legíveis pelo anon. Qualquer pessoa com a URL do site consegue ler e apagar.
2. **Escalada de privilégio**: um usuário authenticated pode alterar o próprio `profiles.role` e criar convites. Qualquer conta Google vira authenticated neste Supabase.
3. **Crons**: os lembretes apontam para o domínio antigo `lovable.app`, e o resumo diário das 7h não foi criado no banco novo.
4. **Endpoints `/api/public/hooks/*`** públicos e sem segredo (risco de disparo no Telegram).
5. **Rotacionar segredos expostos em conversas**: `TELEGRAM_BOT_TOKEN`, `SITE_PASSWORD`, `SESSION_SECRET`.
6. **Legado do Lovable**: verificar se `gestao-diretoria-rl.lovable.app` e o banco antigo ainda estão ativos e desligá-los, e desconectar a integração do Lovable com o GitHub (o ruleset já bloqueia push dele no main).
7. **Supabase Free**: pausa após 7 dias sem uso, junto com o consultório.
8. **Higiene**: Ignored Build Step na Vercel, `.gitattributes` para quebras de linha, remover `bun.lock`, código morto (login por senha, scripts de teste), apagar a branch `sync/producao-2709`.

## 3. Lições

- "Feito" de agente sem prova no banco já enganou mais de uma vez.
- O provisório vira permanente.
- O GitHub ficou 27 dias atrás da produção por causa de deploys pela CLI.
