
CREATE TABLE public.configuracao_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url text,
  cabecalho_texto text,
  rodape_texto text,
  mostrar_timbre boolean NOT NULL DEFAULT true,
  usar_papel_timbrado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracao_documentos TO anon, authenticated;
GRANT ALL ON public.configuracao_documentos TO service_role;

ALTER TABLE public.configuracao_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read configuracao_documentos" ON public.configuracao_documentos FOR SELECT USING (true);
CREATE POLICY "Public can insert configuracao_documentos" ON public.configuracao_documentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update configuracao_documentos" ON public.configuracao_documentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete configuracao_documentos" ON public.configuracao_documentos FOR DELETE USING (true);

INSERT INTO public.configuracao_documentos (mostrar_timbre, usar_papel_timbrado) VALUES (true, false);

-- Storage policies for the documento-timbre bucket
CREATE POLICY "Public read documento-timbre" ON storage.objects FOR SELECT USING (bucket_id = 'documento-timbre');
CREATE POLICY "Public insert documento-timbre" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documento-timbre');
CREATE POLICY "Public update documento-timbre" ON storage.objects FOR UPDATE USING (bucket_id = 'documento-timbre') WITH CHECK (bucket_id = 'documento-timbre');
CREATE POLICY "Public delete documento-timbre" ON storage.objects FOR DELETE USING (bucket_id = 'documento-timbre');
