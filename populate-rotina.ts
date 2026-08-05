import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
distribuir | ideias | card | Gestão | Estudar uma palavra em inglês | false

descarga | descarga | card | Especialização | Enviar aulas do último módulo — Turma 1 | false
descarga | descarga | card | Especialização | Enviar aulas do último módulo — Turma 2 | false
descarga | descarga | card | Financeiro | Organizar o financeiro do consultório | false

rotina_padrao | segunda | card | Graduação | Graduação — organização | false
rotina_padrao | segunda | divisor | | Almoço | false
rotina_padrao | segunda | card | Graduação | Revisão de TCCs | false
rotina_padrao | segunda | divisor | | Turno Noite | false

rotina_padrao | terca | card | Gestão | Pendências gerais (todas as áreas + pessoal) | false
rotina_padrao | terca | card | Financeiro | Pagamentos pessoais (venc. até terça seguinte) | false
rotina_padrao | terca | card | Consultório | Revisar agenda de quarta (atendimento) | false
rotina_padrao | terca | card | Diretoria | Diretoria — organizar tarefas para Isabelle | false
rotina_padrao | terca | divisor | | Almoço | false
rotina_padrao | terca | card | Versa3D | VERSA3D — Protocolo (Fase 1+A / Fase 3+A) | false
rotina_padrao | terca | card | Versa3D | VERSA3D — Organização de pagamentos | false
rotina_padrao | terca | card | Versa3D | VERSA3D — Mensagens | false
rotina_padrao | terca | card | Versa3D | VERSA3D — Comercial | false
rotina_padrao | terca | card | Versa3D | VERSA3D — Marketing | false
rotina_padrao | terca | divisor | | Turno Noite | false

rotina_padrao | quarta | card | Consultório | Consultório | false
rotina_padrao | quarta | divisor | | Almoço | false
rotina_padrao | quarta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
rotina_padrao | quarta | divisor | | Turno Noite | false
rotina_padrao | quarta | card | Connect Lab | LabConnect (noite) | false
rotina_padrao | quarta | card | Versa3D | VERSA3D — Fase 1+A exceção (noite) | false

rotina_padrao | quinta | card | Consultório | Consultório ou Especialização (ver semana) | false
rotina_padrao | quinta | divisor | | Almoço | false
rotina_padrao | quinta | divisor | | Turno Noite | false
rotina_padrao | quinta | card | Doutorado | Doutorado (noite) | false
rotina_padrao | quinta | card | Versa3D | VERSA3D — Fase 3 encadeada (noite) | false

rotina_padrao | sexta | card | Consultório | Ortodontia / Especialização / Livre (ver semana) | false
rotina_padrao | sexta | divisor | | Almoço | false
rotina_padrao | sexta | divisor | | Turno Noite | false
rotina_padrao | sexta | card | Versa3D | VERSA3D — Fase 1 (noite) | false

rotina_padrao | sabado | card | Especialização | Especialização (ver semana) | false
rotina_padrao | sabado | divisor | | Almoço | false
rotina_padrao | sabado | divisor | | Turno Noite | false

semana_1 | segunda | card | Graduação | Graduação — organização | true
semana_1 | segunda | divisor | | Almoço | false
semana_1 | segunda | card | Graduação | Revisão de TCCs | true
semana_1 | segunda | divisor | | Turno Noite | false
semana_1 | segunda | card | Gestão | Exercício físico (30 min) | true
semana_1 | segunda | card | Gestão | Última ação (15 min) | true

semana_1 | terca | card | Gestão | Pendências gerais (todas as áreas + pessoal) | true
semana_1 | terca | card | Financeiro | Pagamentos pessoais (venc. até terça seguinte) | false
semana_1 | terca | card | Consultório | Revisar agenda de quarta (atendimento) | false
semana_1 | terca | card | Diretoria | Diretoria — organizar tarefas para Isabelle | false
semana_1 | terca | divisor | | Almoço | false
semana_1 | terca | card | Versa3D | VERSA3D — Protocolo (Fase 1+A / Fase 3+A) | false
semana_1 | terca | card | Versa3D | VERSA3D — Organização de pagamentos | false
semana_1 | terca | card | Versa3D | VERSA3D — Mensagens | false
semana_1 | terca | card | Versa3D | VERSA3D — Comercial | false
semana_1 | terca | card | Versa3D | VERSA3D — Marketing | false
semana_1 | terca | divisor | | Turno Noite | false
semana_1 | terca | card | Gestão | Exercício físico (30 min) | false
semana_1 | terca | card | Gestão | Última ação (15 min) | false
semana_1 | terca | card | Especialização | Cronograma especialização — Turma 1 | false

semana_1 | quarta | card | Consultório | Consultório | false
semana_1 | quarta | card | Consultório | Revisar agenda de quinta (atendimento) | false
semana_1 | quarta | divisor | | Almoço | false
semana_1 | quarta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_1 | quarta | divisor | | Turno Noite | false
semana_1 | quarta | card | Connect Lab | LabConnect (noite) | false
semana_1 | quarta | card | Versa3D | VERSA3D — Fase 1+A exceção (noite) | false
semana_1 | quarta | card | Gestão | Exercício físico (30 min) | false
semana_1 | quarta | card | Gestão | Última ação (15 min) | false

semana_1 | quinta | card | Consultório | Consultório | false
semana_1 | quinta | divisor | | Almoço | false
semana_1 | quinta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_1 | quinta | divisor | | Turno Noite | false
semana_1 | quinta | card | Doutorado | Doutorado (noite) | false
semana_1 | quinta | card | Versa3D | VERSA3D — Fase 3 encadeada (noite) | false
semana_1 | quinta | card | Gestão | Exercício físico (30 min) | false
semana_1 | quinta | card | Gestão | Última ação (15 min) | false

semana_1 | sexta | card | Consultório | Serviço de Ortodontia | false
semana_1 | sexta | divisor | | Almoço | false
semana_1 | sexta | divisor | | Turno Noite | false
semana_1 | sexta | card | Versa3D | VERSA3D — Fase 1 (noite) | false
semana_1 | sexta | card | Gestão | Exercício físico (30 min) | false
semana_1 | sexta | card | Gestão | Última ação (15 min) | false

semana_1 | sabado | divisor | | Almoço | false
semana_1 | sabado | divisor | | Turno Noite | false

semana_2 | segunda | card | Graduação | Graduação — organização | false
semana_2 | segunda | card | Graduação | Revisão de TCCs | false
semana_2 | segunda | divisor | | Almoço | false
semana_2 | segunda | divisor | | Turno Noite | false
semana_2 | segunda | card | Gestão | Exercício físico (30 min) | false
semana_2 | segunda | card | Gestão | Última ação (15 min) | false

semana_2 | terca | card | Gestão | Pendências gerais (todas as áreas + pessoal) | false
semana_2 | terca | card | Financeiro | Pagamentos pessoais (venc. até terça seguinte) | false
semana_2 | terca | card | Consultório | Revisar agenda de quarta (atendimento) | false
semana_2 | terca | card | Diretoria | Diretoria — organizar tarefas para Isabelle | false
semana_2 | terca | divisor | | Almoço | false
semana_2 | terca | card | Versa3D | VERSA3D — Protocolo (Fase 1+A / Fase 3+A) | false
semana_2 | terca | card | Versa3D | VERSA3D — Organização de pagamentos | false
semana_2 | terca | card | Versa3D | VERSA3D — Mensagens | false
semana_2 | terca | card | Versa3D | VERSA3D — Comercial | false
semana_2 | terca | card | Versa3D | VERSA3D — Marketing | false
semana_2 | terca | divisor | | Turno Noite | false
semana_2 | terca | card | Gestão | Exercício físico (30 min) | false
semana_2 | terca | card | Gestão | Última ação (15 min) | false

semana_2 | quarta | card | Consultório | Consultório | false
semana_2 | quarta | divisor | | Almoço | false
semana_2 | quarta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_2 | quarta | divisor | | Turno Noite | false
semana_2 | quarta | card | Connect Lab | LabConnect (noite) | false
semana_2 | quarta | card | Versa3D | VERSA3D — Fase 1+A exceção (noite) | false
semana_2 | quarta | card | Gestão | Exercício físico (30 min) | false
semana_2 | quarta | card | Gestão | Última ação (15 min) | false

semana_2 | quinta | card | Especialização | Especialização — Turma 2 | false
semana_2 | quinta | divisor | | Almoço | false
semana_2 | quinta | divisor | | Turno Noite | false
semana_2 | quinta | card | Doutorado | Doutorado (noite) | false
semana_2 | quinta | card | Versa3D | VERSA3D — Fase 3 encadeada (noite) | false
semana_2 | quinta | card | Gestão | Exercício físico (30 min) | false
semana_2 | quinta | card | Gestão | Última ação (15 min) | false

semana_2 | sexta | card | Especialização | Especialização — Turma 2 | false
semana_2 | sexta | divisor | | Almoço | false
semana_2 | sexta | divisor | | Turno Noite | false
semana_2 | sexta | card | Gestão | Exercício físico (30 min) | false
semana_2 | sexta | card | Gestão | Última ação (15 min) | false

semana_2 | sabado | card | Especialização | Especialização — Turma 2 | false
semana_2 | sabado | divisor | | Almoço | false
semana_2 | sabado | divisor | | Turno Noite | false

semana_3 | segunda | card | Graduação | Graduação — organização | false
semana_3 | segunda | card | Graduação | Revisão de TCCs | false
semana_3 | segunda | divisor | | Almoço | false
semana_3 | segunda | divisor | | Turno Noite | false
semana_3 | segunda | card | Gestão | Exercício físico (30 min) | false
semana_3 | segunda | card | Gestão | Última ação (15 min) | false

semana_3 | terca | card | Gestão | Pendências gerais (todas as áreas + pessoal) | false
semana_3 | terca | card | Financeiro | Pagamentos pessoais (venc. até terça seguinte) | false
semana_3 | terca | card | Consultório | Revisar agenda de quarta (atendimento) | false
semana_3 | terca | card | Diretoria | Diretoria — organizar tarefas para Isabelle | false
semana_3 | terca | divisor | | Almoço | false
semana_3 | terca | card | Versa3D | VERSA3D — Protocolo (Fase 1+A / Fase 3+A) | false
semana_3 | terca | card | Versa3D | VERSA3D — Organização de pagamentos | false
semana_3 | terca | card | Versa3D | VERSA3D — Mensagens | false
semana_3 | terca | card | Versa3D | VERSA3D — Comercial | false
semana_3 | terca | divisor | | Turno Noite | false
semana_3 | terca | card | Especialização | Cronograma especialização — Turma 2 | false
semana_3 | terca | card | Gestão | Exercício físico (30 min) | false
semana_3 | terca | card | Gestão | Última ação (15 min) | false
semana_3 | terca | card | Versa3D | VERSA3D — Marketing | false

semana_3 | quarta | card | Consultório | Consultório | false
semana_3 | quarta | card | Consultório | Revisar agenda de quinta (atendimento) | false
semana_3 | quarta | divisor | | Almoço | false
semana_3 | quarta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_3 | quarta | divisor | | Turno Noite | false
semana_3 | quarta | card | Connect Lab | LabConnect (noite) | false
semana_3 | quarta | card | Versa3D | VERSA3D — Fase 1+A exceção (noite) | false
semana_3 | quarta | card | Gestão | Exercício físico (30 min) | false
semana_3 | quarta | card | Gestão | Última ação (15 min) | false

semana_3 | quinta | card | Consultório | Consultório | false
semana_3 | quinta | divisor | | Almoço | false
semana_3 | quinta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_3 | quinta | divisor | | Turno Noite | false
semana_3 | quinta | card | Doutorado | Doutorado (noite) | false
semana_3 | quinta | card | Versa3D | VERSA3D — Fase 3 encadeada (noite) | false
semana_3 | quinta | card | Gestão | Exercício físico (30 min) | false
semana_3 | quinta | card | Gestão | Última ação (15 min) | false

semana_3 | sexta | card | Gestão | Livre | false
semana_3 | sexta | divisor | | Almoço | false
semana_3 | sexta | divisor | | Turno Noite | false
semana_3 | sexta | card | Versa3D | VERSA3D — Fase 1 (noite) | false
semana_3 | sexta | card | Gestão | Exercício físico (30 min) | false
semana_3 | sexta | card | Gestão | Última ação (15 min) | false

semana_3 | sabado | divisor | | Almoço | false
semana_3 | sabado | divisor | | Turno Noite | false

semana_4 | segunda | card | Graduação | Graduação — organização | false
semana_4 | segunda | card | Graduação | Revisão de TCCs | false
semana_4 | segunda | divisor | | Almoço | false
semana_4 | segunda | divisor | | Turno Noite | false
semana_4 | segunda | card | Gestão | Exercício físico (30 min) | false
semana_4 | segunda | card | Gestão | Última ação (15 min) | false

semana_4 | terca | card | Gestão | Pendências gerais (todas as áreas + pessoal) | false
semana_4 | terca | card | Financeiro | Pagamentos pessoais (venc. até terça seguinte) | false
semana_4 | terca | card | Consultório | Revisar agenda de quarta (atendimento) | false
semana_4 | terca | card | Diretoria | Diretoria — organizar tarefas para Isabelle | false
semana_4 | terca | divisor | | Almoço | false
semana_4 | terca | card | Versa3D | VERSA3D — Protocolo (Fase 1+A / Fase 3+A) | false
semana_4 | terca | card | Versa3D | VERSA3D — Organização de pagamentos | false
semana_4 | terca | card | Versa3D | VERSA3D — Mensagens | false
semana_4 | terca | card | Versa3D | VERSA3D — Comercial | false
semana_4 | terca | card | Versa3D | VERSA3D — Marketing | false
semana_4 | terca | divisor | | Turno Noite | false
semana_4 | terca | card | Gestão | Exercício físico (30 min) | false
semana_4 | terca | card | Gestão | Última ação (15 min) | false

semana_4 | quarta | card | Consultório | Consultório | false
semana_4 | quarta | divisor | | Almoço | false
semana_4 | quarta | card | Financeiro | Lançar pagamentos, procedimentos e recebimentos | false
semana_4 | quarta | divisor | | Turno Noite | false
semana_4 | quarta | card | Connect Lab | LabConnect (noite) | false
semana_4 | quarta | card | Versa3D | VERSA3D — Fase 1+A exceção (noite) | false
semana_4 | quarta | card | Gestão | Exercício físico (30 min) | false
semana_4 | quarta | card | Gestão | Última ação (15 min) | false

semana_4 | quinta | card | Especialização | Especialização — Turma 1 | false
semana_4 | quinta | divisor | | Almoço | false
semana_4 | quinta | divisor | | Turno Noite | false
semana_4 | quinta | card | Doutorado | Doutorado (noite) | false
semana_4 | quinta | card | Versa3D | VERSA3D — Fase 3 encadeada (noite) | false
semana_4 | quinta | card | Gestão | Exercício físico (30 min) | false
semana_4 | quinta | card | Gestão | Última ação (15 min) | false

semana_4 | sexta | card | Especialização | Especialização — Turma 1 | false
semana_4 | sexta | divisor | | Almoço | false
semana_4 | sexta | divisor | | Turno Noite | false
semana_4 | sexta | card | Gestão | Exercício físico (30 min) | false
semana_4 | sexta | card | Gestão | Última ação (15 min) | false

semana_4 | sabado | card | Especialização | Especialização — Turma 1 | false
semana_4 | sabado | divisor | | Almoço | false
semana_4 | sabado | divisor | | Turno Noite | false
`;

const areaMap = {
  'Gestão': 'gestao',
  'Especialização': 'especializacao',
  'Financeiro': 'financeiro',
  'Graduação': 'graduacao',
  'Consultório': 'consultorio',
  'Diretoria': 'diretoria',
  'Versa3D': 'versa3d',
  'Doutorado': 'doutorado',
  'Connect Lab': 'connect-lab',
  'Dentistas Petrópolis': 'dentistas-petropolis'
};

const cards = [];
const orders = {};

rawData.trim().split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  
  const parts = trimmed.split('|').map(p => p.trim());
  if (parts.length < 6) return;
  
  const [tab, coluna, tipo_linha, areaName, texto, concluidoStr] = parts;
  const area = areaMap[areaName] || null;
  const concluido = concluidoStr === 'true';
  
  const key = tab + '|' + coluna;
  orders[key] = (orders[key] || 0) + 1;
  
  cards.push({
    tab,
    coluna,
    tipo_linha,
    area,
    texto,
    concluido,
    ordem: orders[key]
  });
});

async function run() {
  console.log("Populating " + cards.length + " cards...");
  try {
    const { error: delError } = await supabase
      .from("rotina_cards")
      .delete()
      .not("id", "is", null);

    if (delError) throw delError;

    const batchSize = 50;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const { error: insError } = await supabase
        .from("rotina_cards")
        .insert(batch);
      if (insError) throw insError;
      console.log("Inserted batch " + (i / batchSize + 1));
    }
    
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
