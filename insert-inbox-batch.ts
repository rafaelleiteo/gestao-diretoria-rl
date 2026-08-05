import { supabase } from "./src/integrations/supabase/client.server.js";
import { ALL_AREA_OPTIONS } from "./src/lib/areas.js";

const itemsStr = `Comprar lâmpadas para o consultório;Consultório;;importante
Preparar TCC;Especialização;;urgente
Rever caso da Luciana;Consultório;;urgente
Rever caso da Tatiana;Consultório;;importante
Falar com Erasmo;Versa3D;;urgente
Imposto de Renda Isabelle;Financeiro;;importante
Pensar na situação da professora Letícia;Especialização;;importante
Comprar pilhas para o consultório;Consultório;;longo_prazo
Comprar água oxigenada;Geral;;longo_prazo
Fechar pagamento da Isabelle;Financeiro;;urgente
Ver aula de graduação da Letícia;Graduação;;urgente
Fazer relação de aulas;Graduação;;importante
Verificar notas fiscais do consultório;Consultório;;descarga,urgente
Ver datas para professor Breno;Especialização;;importante
Ver datas para professor Fernando;Especialização;;
Ver data para professor Wellington;Especialização;;
Ver caso da Juliana;Consultório;;
Organizar a primeira aula de ortodontia;Graduação;;urgente
Rever dúvidas da aula de fisiologia oral;Graduação;;urgente
Buscar aplicativo para ver arquivos do iPhone;Geral;;longo_prazo
Ver aplicativos de arquivos para computador;Geral;;longo_prazo
Planejar conserto do notebook;Versa3D;;urgente
Verificar cartão Santander básico;Financeiro;;longo_prazo
Preparar apresentação de tese;Doutorado;;urgente`;

async function run() {
  const lines = itemsStr.split('\n');
  const itemsToInsert = [];
  const validPriorities = ["urgente", "hoje", "importante", "longo_prazo", "indiferente", "descarga"];
  const validTypes = ["mensagem", "ideia", "tarefa"];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const parts = trimmed.split(";").map(p => p.trim());
    const texto = parts[0];
    if (!texto) continue;

    // Area
    let area = "geral";
    if (parts[1]) {
      const matchedArea = ALL_AREA_OPTIONS.find(a => a.label.toLowerCase() === parts[1].toLowerCase());
      if (matchedArea) area = matchedArea.value;
    }

    // Tipo
    let tipo = "tarefa";
    if (parts[2]) {
      const typeInput = parts[2].toLowerCase();
      if (validTypes.includes(typeInput)) tipo = typeInput;
    }

    // Prioridade
    let prioridades = ["indiferente"];
    if (parts[3]) {
      const raw = parts[3].split(",").map(p => p.trim().toLowerCase());
      const filtered = raw.filter(p => validPriorities.includes(p));
      if (filtered.length > 0) prioridades = filtered;
    }

    itemsToInsert.push({
      texto,
      area,
      tipo,
      prioridades,
      concluido: false,
      aguardando_feedback: false
    });
  }

  console.log(`Inserindo ${itemsToInsert.length} itens...`);
  const { error } = await supabase.from('inbox_items').insert(itemsToInsert);
  
  if (error) {
    console.error("Erro na inserção:", error);
    process.exit(1);
  }
  
  console.log("Sucesso!");
}

run();
