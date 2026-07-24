
CREATE TABLE public.documento_modelos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('encaminhamento','atestado','declaracao','receituario')),
  nome text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_modelos TO anon, authenticated;
GRANT ALL ON public.documento_modelos TO service_role;

ALTER TABLE public.documento_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read documento_modelos" ON public.documento_modelos FOR SELECT USING (true);
CREATE POLICY "Public can insert documento_modelos" ON public.documento_modelos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update documento_modelos" ON public.documento_modelos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete documento_modelos" ON public.documento_modelos FOR DELETE USING (true);

INSERT INTO public.documento_modelos (tipo, nome, conteudo, ordem) VALUES
('encaminhamento','Avaliação Periodontal','Encaminho o(a) {{paciente}} solicitando avaliação periodontal e o tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',1),
('encaminhamento','Exodontia','Encaminho o(a) {{paciente}} solicitando avaliação para exodontia do(s) {{dente_singular_plural}}: {{campo_dentes}}. Agradeço antecipadamente pela atenção dedicada ao paciente.',2),
('encaminhamento','Endodontia','Encaminho o(a) {{paciente}} solicitando avaliação endodôntica do(s) {{dente_singular_plural}}: {{campo_dentes}} e o tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',3),
('encaminhamento','Avaliação Geral','Encaminho o(a) {{paciente}} para avaliação geral da saúde bucal. Solicito que seja realizada profilaxia, avaliação da presença de tecido cariado nas arcadas superior e inferior, avaliação periodontal e análise das condições das restaurações. Agradeço antecipadamente pela atenção dedicada ao paciente.',4),
('encaminhamento','Implante','Encaminho o(a) {{paciente}} para avaliação e possível instalação de implantes na região do(s) {{dente_singular_plural}}: {{campo_dentes}}, bem como para planejamento da reabilitação protética. Agradeço antecipadamente pela atenção dedicada ao paciente.',5),
('encaminhamento','Ortodontia','Encaminho o(a) {{paciente}} para avaliação ortodôntica e planejamento do tratamento que julgar necessário. Agradeço antecipadamente pela atenção dedicada ao paciente.',6),
('atestado','Atestado Odontológico','Regulamentado pelas Leis nº 5.081, de 24/08/1966, e nº 6.215, de 30/06/1975. Atesto, para fins {{finalidade}}, a pedido, que {{paciente}} esteve sob tratamento odontológico neste consultório, no período das {{hora_inicio}} às {{hora_fim}} horas, no dia {{data}}{{repouso}}.',7),
('declaracao','Declaração de Comparecimento','Declaro que o(a) paciente {{paciente}} compareceu a esta clínica odontológica no dia {{data}}, no horário das {{hora_inicio}} às {{hora_fim}} horas, para realização de tratamento odontológico.',8),
('receituario','Receituário','',9);
