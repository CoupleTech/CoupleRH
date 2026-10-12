/**
 * Validador e utilitários de tabelas legais para o motor de cálculo da folha.
 * Implementa as regras estritas da tarefa T7 (Doc §4 e Instruções de Correção).
 */

export function formatPeriodStartDate(year: number, month: number): string {
  const m = String(month).padStart(2, '0');
  return `${year}-${m}-01`;
}

export function validateLegalVersion(version: any, periodMonth: number, periodYear: number): void {
  if (!version || !version.id) {
    throw new Error(
      `Nenhuma versão de parâmetros legais (legal_versions) vigente encontrada para a competência ${periodMonth}/${periodYear}.`
    );
  }
}

export function validateInssParameters(inssBrackets: any[], versionName: string = 'vigente'): void {
  if (!inssBrackets || !Array.isArray(inssBrackets) || inssBrackets.length === 0) {
    throw new Error(
      `Parâmetros de INSS ausentes (tabela inss_parameters vazia para a versão legal ${versionName}).`
    );
  }

  // Ordena por bracket_number ascendente para analisar a última faixa
  const sorted = [...inssBrackets].sort((a, b) => (a.bracket_number || 0) - (b.bracket_number || 0));
  const lastBracket = sorted[sorted.length - 1];

  // No INSS brasileiro, a última faixa é limitada pelo teto do INSS
  if (lastBracket.base_limit === null || lastBracket.base_limit === undefined || Number(lastBracket.base_limit) <= 0) {
    throw new Error(
      `Inconsistência nos parâmetros de INSS da versão ${versionName}: a última faixa de INSS deve possuir limite (teto de contribuição previdenciária).`
    );
  }
}

export function validateIrrfParameters(irrfBrackets: any[], versionName: string = 'vigente'): void {
  if (!irrfBrackets || !Array.isArray(irrfBrackets) || irrfBrackets.length === 0) {
    throw new Error(
      `Parâmetros de IRRF ausentes (tabela irrf_parameters vazia para a versão legal ${versionName}).`
    );
  }

  // Ordena por bracket_number ascendente para analisar a última faixa
  const sorted = [...irrfBrackets].sort((a, b) => (a.bracket_number || 0) - (b.bracket_number || 0));
  const lastBracket = sorted[sorted.length - 1];

  // No IRRF brasileiro, a última faixa deve ser aberta (base_limit nulo / sem teto)
  if (lastBracket.base_limit !== null && lastBracket.base_limit !== undefined) {
    throw new Error(
      `Inconsistência nos parâmetros de IRRF da versão ${versionName}: a última faixa de IRRF deve ser aberta (base_limit deve ser nulo).`
    );
  }
}

export function validateGeneralLegalParameters(generalParams: any, versionName: string = 'vigente'): void {
  if (!generalParams || typeof generalParams !== 'object') {
    throw new Error(
      `Parâmetros legais gerais ausentes (tabela general_legal_parameters vazia para a versão legal ${versionName}).`
    );
  }

  const mw = generalParams.minimum_wage;
  if (mw === null || mw === undefined || Number(mw) <= 0) {
    throw new Error(
      `Parâmetro legal obrigatório ausente: salário mínimo ('minimum_wage') não cadastrado ou zerado na versão legal ${versionName}.`
    );
  }
}

export function validateAllLegalTables(params: {
  version: any;
  inssBrackets: any[];
  irrfBrackets: any[];
  generalParams: any;
  periodMonth: number;
  periodYear: number;
}): void {
  const { version, inssBrackets, irrfBrackets, generalParams, periodMonth, periodYear } = params;
  validateLegalVersion(version, periodMonth, periodYear);
  const versionName = version.version_name || version.id || 'vigente';
  validateInssParameters(inssBrackets, versionName);
  validateIrrfParameters(irrfBrackets, versionName);
  validateGeneralLegalParameters(generalParams, versionName);
}
