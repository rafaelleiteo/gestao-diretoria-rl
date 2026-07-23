
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
