import { AreaValue } from "./areas";

export type RotinaCardType = 'card' | 'divisor';
export type RotinaTab = 'distribuir' | 'descarga' | 'rotina_padrao' | 'semana_1' | 'semana_2' | 'semana_3' | 'semana_4';

export interface DefaultCard {
  tab: RotinaTab;
  coluna: string;
  area: AreaValue | null;
  tipo_linha: RotinaCardType;
  texto: string;
  ordem: number;
}

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const WEEKS: RotinaTab[] = ['rotina_padrao', 'semana_1', 'semana_2', 'semana_3', 'semana_4'];

export const ROTINA_DEFAULTS: DefaultCard[] = [
  // DESCARGA
  { tab: 'descarga', coluna: 'descarga', area: 'especializacao', tipo_linha: 'card', texto: 'Enviar aulas do último módulo — Turma 1', ordem: 0 },
  { tab: 'descarga', coluna: 'descarga', area: 'especializacao', tipo_linha: 'card', texto: 'Enviar aulas do último módulo — Turma 2', ordem: 1 },
  { tab: 'descarga', coluna: 'descarga', area: 'financeiro', tipo_linha: 'card', texto: 'Organizar o financeiro do consultório', ordem: 2 },

  // DISTRIBUIR
  { tab: 'distribuir', coluna: 'ideias', area: 'gestao', tipo_linha: 'card', texto: 'Estudar uma palavra em inglês', ordem: 0 },
];

// Generate weekly defaults
WEEKS.forEach(week => {
  let order = 0;
  
  // Divisors for all days in week views
  DIAS.forEach(dia => {
    // We'll insert these later in the specific day logic to maintain order
  });

  // SEGUNDA
  order = 0;
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'segunda', area: 'graduacao', tipo_linha: 'card', texto: 'Graduação — organização', ordem: order++ });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'segunda', area: 'graduacao', tipo_linha: 'card', texto: 'Revisão de TCCs', ordem: order++ });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'segunda', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'segunda', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });
  
  // TERÇA
  order = 0;
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'gestao', tipo_linha: 'card', texto: 'Pendências gerais (todas as áreas + pessoal)', ordem: order++ });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'financeiro', tipo_linha: 'card', texto: 'Pagamentos pessoais (venc. até terça seguinte)', ordem: order++ });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'consultorio', tipo_linha: 'card', texto: 'Revisar agenda de quarta (atendimento)', ordem: order++ });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'diretoria', tipo_linha: 'card', texto: 'Diretoria — organizar tarefas para Isabelle', ordem: order++ });
  
  if (week === 'semana_1') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'especializacao', tipo_linha: 'card', texto: 'Cronograma especialização — Turma 2', ordem: order++ });
  } else if (week === 'semana_3') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'especializacao', tipo_linha: 'card', texto: 'Cronograma especialização — Turma 1', ordem: order++ });
  }
  
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Protocolo (Fase 1+A / Fase 3+A)', ordem: 101 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Organização de pagamentos', ordem: 102 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Mensagens', ordem: 103 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Comercial', ordem: 104 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Marketing', ordem: 105 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'terca', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });

  // QUARTA
  order = 0;
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: 'consultorio', tipo_linha: 'card', texto: 'Consultório', ordem: order++ });
  if (week === 'semana_1' || week === 'semana_3') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: 'consultorio', tipo_linha: 'card', texto: 'Revisar agenda de quinta (atendimento)', ordem: order++ });
  }
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: 'financeiro', tipo_linha: 'card', texto: 'Lançar pagamentos, procedimentos e recebimentos', ordem: 101 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: 'connect-lab', tipo_linha: 'card', texto: 'LabConnect (noite)', ordem: 201 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quarta', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Fase 1+A exceção (noite)', ordem: 202 });

  // QUINTA
  order = 0;
  if (week === 'rotina_padrao') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'consultorio', tipo_linha: 'card', texto: 'Consultório ou Especialização (ver semana)', ordem: order++ });
  } else if (week === 'semana_1' || week === 'semana_3') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'consultorio', tipo_linha: 'card', texto: 'Consultório', ordem: order++ });
  } else if (week === 'semana_2') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 2', ordem: order++ });
  } else if (week === 'semana_4') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 1', ordem: order++ });
  }
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  if (week === 'semana_1' || week === 'semana_3') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'financeiro', tipo_linha: 'card', texto: 'Lançar pagamentos, procedimentos e recebimentos', ordem: 101 });
  }
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'doutorado', tipo_linha: 'card', texto: 'Doutorado (noite)', ordem: 201 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'quinta', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Fase 3 encadeada (noite)', ordem: 202 });

  // SEXTA
  order = 0;
  if (week === 'rotina_padrao') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'consultorio', tipo_linha: 'card', texto: 'Ortodontia / Especialização / Livre (ver semana)', ordem: order++ });
  } else if (week === 'semana_1') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'consultorio', tipo_linha: 'card', texto: 'Serviço de Ortodontia', ordem: order++ });
  } else if (week === 'semana_2') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 2', ordem: order++ });
  } else if (week === 'semana_4') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 1', ordem: order++ });
  } else if (week === 'semana_3') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'gestao', tipo_linha: 'card', texto: 'Livre', ordem: order++ });
  }
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });
  if (week !== 'semana_2') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sexta', area: 'versa3d', tipo_linha: 'card', texto: 'VERSA3D — Fase 1 (noite)', ordem: 201 });
  }

  // SÁBADO
  order = 0;
  if (week === 'rotina_padrao') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sabado', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização (ver semana)', ordem: order++ });
  } else if (week === 'semana_2') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sabado', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 2', ordem: order++ });
  } else if (week === 'semana_4') {
    ROTINA_DEFAULTS.push({ tab: week, coluna: 'sabado', area: 'especializacao', tipo_linha: 'card', texto: 'Especialização — Turma 1', ordem: order++ });
  }
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'sabado', area: null, tipo_linha: 'divisor', texto: 'Almoço', ordem: 100 });
  ROTINA_DEFAULTS.push({ tab: week, coluna: 'sabado', area: null, tipo_linha: 'divisor', texto: 'Turno Noite', ordem: 200 });

  // Common items for Seg-Sex
  ['segunda', 'terca', 'quarta', 'quinta', 'sexta'].forEach(dia => {
    // Add physical exercise and last action at the end of the day (before/after Turno Noite)
    // Actually prompt says "adicionados ao final de cada um desses dias"
    ROTINA_DEFAULTS.push({ tab: week, coluna: dia, area: 'gestao', tipo_linha: 'card', texto: 'Exercício físico (30 min)', ordem: 300 });
    ROTINA_DEFAULTS.push({ tab: week, coluna: dia, area: 'gestao', tipo_linha: 'card', texto: 'Última ação (15 min)', ordem: 301 });
  });
});
