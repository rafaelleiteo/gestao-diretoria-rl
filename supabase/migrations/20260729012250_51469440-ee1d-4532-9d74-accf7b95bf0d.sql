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
$function$;