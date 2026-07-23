ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS lembrete_data_hora TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_enviado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inbox_items_lembrete_pendente
  ON public.inbox_items (lembrete_data_hora)
  WHERE lembrete_enviado = false AND lembrete_data_hora IS NOT NULL;