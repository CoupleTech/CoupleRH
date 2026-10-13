import { round2, multiplyMoney, divideMoney } from '../utils/money';
import { RubricFormulaParser, FormulaError } from '../../supabase/functions/payroll-engine/rubrics/RubricFormulaParser';
import { RubricKind } from '../../supabase/functions/payroll-engine/engine/PayrollContext';
export type { RubricKind };

export interface RubricIncidenceFlags {
  inss: boolean;
  irrf: boolean;
  fgts: boolean;
  integra_dsr?: boolean;
  media_ferias?: boolean;
  media_13?: boolean;
  inss_patronal?: boolean;
  rat?: boolean;
  terceiros?: boolean;
  irrf_mode?: 'NORMAL' | 'EXCLUSIVO' | 'TABELA_PLR';
}

export interface RubricConfig {
  id?: string;
  code: string;
  name: string;
  description?: string;
  type: 'EARNING' | 'DEDUCTION';
  rubric_kind: RubricKind;
  category?: string;
  calculation_form: 'FIXO' | 'PERCENTUAL' | 'FORMULA';
  calculation_base?: string;
  percentage?: number | null;
  divisor?: number | null;
  factor?: number | null;
  quantity?: number | null;
  calculation_order?: number;
  formula?: string;
  esocial_nature?: string;
  legal_basis?: string;
  status?: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED';
  valid_from?: string;
  valid_to?: string | null;
  version?: number;
  incidences?: RubricIncidenceFlags;
}

export interface SimulationEmployeeContext {
  salary: number;
  minimum_wage: number;
  divisor: number;
  quantity: number;
  factor: number;
  dias_uteis?: number;
  dias_inuteis?: number;
  custom_variables?: Record<string, number>;
}

export interface SimulationResult {
  success: boolean;
  calculatedAmount: number;
  calculationMemory: string;
  taxImpact: {
    inss: number;
    irrf: number;
    fgts: number;
    dsr: number;
  };
  netImpact: number;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const PUBLISHED_VARIABLES = [
  'SALARY',
  'MINIMUM_WAGE',
  'DIVISOR',
  'FACTOR',
  'QUANTITY',
  'BASE_DSR',
  'BASE_DSR_NOTURNO',
  'BASE_HORA_EXTRA',
  'BASE_FERIAS',
  'BASE_13',
  'DIAS_UTEIS',
  'DIAS_INUTEIS',
] as const;

export interface RubricTemplate {
  id: string;
  title: string;
  description: string;
  type: 'EARNING' | 'DEDUCTION';
  rubric_kind: RubricKind;
  calculation_form: 'FIXO' | 'PERCENTUAL' | 'FORMULA';
  calculation_base?: string;
  percentage?: number;
  divisor?: number;
  factor?: number;
  quantity?: number;
  formula?: string;
  esocial_nature?: string;
  defaultIncidences: RubricIncidenceFlags;
}

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    id: 'ADICIONAL_PERCENTUAL',
    title: 'Adicional Percentual (%)',
    description: 'Calcula percentual fixo sobre o salário base ou salário mínimo (ex: adicional de função, insalubridade, periculosidade).',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'PERCENTUAL',
    calculation_base: 'SALARY',
    percentage: 20,
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: false,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'VALOR_FIXO_PROVENTO',
    title: 'Valor Fixo (Provento)',
    description: 'Lançamento com valor em reais determinado para o mês (ex: gratificação acordada, bonificação simples).',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'FIXO',
    quantity: 100,
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: false,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'HORAS_FATOR',
    title: 'Horas x Fator (Hora Extra / Adicional)',
    description: 'Calcula valor por hora multiplicando por um fator (ex: 1.5 para 50%, 2.0 para 100%) e pelas horas lançadas.',
    type: 'EARNING',
    rubric_kind: 'OVERTIME',
    calculation_form: 'FORMULA',
    divisor: 220,
    factor: 1.5,
    quantity: 1,
    formula: '(SALARY / DIVISOR) * FACTOR * QUANTITY',
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: true,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'COMISSAO',
    title: 'Comissão / Produção Variável',
    description: 'Valor de comissões auferidas no período, que integram base tributária e geram reflexo de DSR.',
    type: 'EARNING',
    rubric_kind: 'COMMISSION',
    calculation_form: 'FIXO',
    quantity: 500,
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: true,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'GRATIFICACAO',
    title: 'Gratificação de Função',
    description: 'Gratificação percentual pelo exercício de cargo de confiança (gerência/coordenação).',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'PERCENTUAL',
    calculation_base: 'SALARY',
    percentage: 40,
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: false,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'DESCONTO_FIXO',
    title: 'Desconto Fixo (Convênio / Empréstimo / Seguro)',
    description: 'Desconto mensal de valor fixo autorizado pelo colaborador (sem incidências tributárias).',
    type: 'DEDUCTION',
    rubric_kind: 'OTHER',
    calculation_form: 'FIXO',
    quantity: 50,
    defaultIncidences: {
      inss: false,
      irrf: false,
      fgts: false,
      integra_dsr: false,
      inss_patronal: false,
      rat: false,
      terceiros: false,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'DESCONTO_PERCENTUAL',
    title: 'Desconto Percentual (ex: Vale Transporte 6%)',
    description: 'Desconto de percentual sobre o salário base contratual conforme teto legal.',
    type: 'DEDUCTION',
    rubric_kind: 'OTHER',
    calculation_form: 'PERCENTUAL',
    calculation_base: 'SALARY',
    percentage: 6,
    defaultIncidences: {
      inss: false,
      irrf: false,
      fgts: false,
      integra_dsr: false,
      inss_patronal: false,
      rat: false,
      terceiros: false,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'PLR',
    title: 'Participação nos Lucros e Resultados (PLR)',
    description: 'Participação nos Lucros (Lei 10.101/2000): isenta de INSS/FGTS, com tributação exclusiva de IRRF na fonte.',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'FIXO',
    quantity: 1000,
    esocial_nature: '2501',
    defaultIncidences: {
      inss: false,
      irrf: true,
      fgts: false,
      integra_dsr: false,
      inss_patronal: false,
      rat: false,
      terceiros: false,
      irrf_mode: 'TABELA_PLR',
    },
  },
  {
    id: 'INDENIZACAO',
    title: 'Indenização / Ajuda de Custo',
    description: 'Verba indenizatória que não compõe remuneração (CLT art. 457 §2º); isenta de tributos e encargos.',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'FIXO',
    quantity: 200,
    esocial_nature: '2000',
    defaultIncidences: {
      inss: false,
      irrf: false,
      fgts: false,
      integra_dsr: false,
      inss_patronal: false,
      rat: false,
      terceiros: false,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'BENEFICIO',
    title: 'Auxílio / Benefício Alimentação (PAT)',
    description: 'Ajuda para alimentação no âmbito do PAT, não incorporável ao salário contratual.',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'FIXO',
    quantity: 400,
    esocial_nature: '1099',
    defaultIncidences: {
      inss: false,
      irrf: false,
      fgts: false,
      integra_dsr: false,
      inss_patronal: false,
      rat: false,
      terceiros: false,
      irrf_mode: 'NORMAL',
    },
  },
  {
    id: 'FORMULA_CUSTOMIZADA',
    title: 'Fórmula Matemática Customizada',
    description: 'Expressão matemática parametrizável operando sobre variáveis da folha.',
    type: 'EARNING',
    rubric_kind: 'OTHER',
    calculation_form: 'FORMULA',
    formula: '(SALARY * 0.10) + 100',
    defaultIncidences: {
      inss: true,
      irrf: true,
      fgts: true,
      integra_dsr: false,
      inss_patronal: true,
      rat: true,
      terceiros: true,
      irrf_mode: 'NORMAL',
    },
  },
];

export interface EsocialNatureInfo {
  code: string;
  name: string;
  inss: boolean;
  irrf: boolean;
  fgts: boolean;
  integra_dsr: boolean;
  inss_patronal: boolean;
  rat: boolean;
  terceiros: boolean;
  irrf_mode: 'NORMAL' | 'EXCLUSIVO' | 'TABELA_PLR';
  legal_basis: string;
  justification: string;
}

export const ESOCIAL_NATURE_SUGGESTIONS: Record<string, EsocialNatureInfo> = {
  '1000': {
    code: '1000',
    name: 'Salário, vencimento, soldo',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 457; Lei 8.212/1991',
    justification: 'Remuneração principal pelo tempo trabalhado, com tributação plena e encargos patronais integrais.',
  },
  '1003': {
    code: '1003',
    name: 'Horas extraordinárias',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: true,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 59; CF/88 art. 7º XVI; Súmula 172 TST',
    justification: 'Remuneração por horas adicionais; gera reflexo obrigatório no DSR e incide sobre INSS, IRRF e FGTS.',
  },
  '1004': {
    code: '1004',
    name: 'Adicional noturno',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: true,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 73; Súmula 60 TST',
    justification: 'Adicional pago pelo trabalho noturno entre 22h e 5h; integra DSR e bases tributárias.',
  },
  '1005': {
    code: '1005',
    name: 'Adicional de insalubridade',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT arts. 189 a 192; Súmula Vinculante 4 STF',
    justification: 'Adicional por exposição a agentes nocivos (10%, 20% ou 40% sobre o salário mínimo ou CCT).',
  },
  '1006': {
    code: '1006',
    name: 'Adicional de periculosidade',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 193 §1º; Súmula 191 TST',
    justification: '30% sobre o salário básico em atividades com inflamáveis, explosivos, eletricidade ou segurança.',
  },
  '1010': {
    code: '1010',
    name: 'Descanso Semanal Remunerado - DSR',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'Lei 605/1949; Súmula 172 TST',
    justification: 'Reflexo remuneratório do repouso semanal sobre horas extras, adicionais e comissões.',
  },
  '1020': {
    code: '1020',
    name: 'Comissões, percentagens, produção',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: true,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 457 §1º; Súmula 27 TST',
    justification: 'Salário variável que integra a remuneração com reflexo em DSR e todos os encargos.',
  },
  '1022': {
    code: '1022',
    name: 'Prêmios',
    inss: false,
    irrf: true,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 457 §4º (Lei 13.467/2017)',
    justification: 'Liberalidade por desempenho extraordinário; isento de encargos trabalhistas/previdenciários, tributado pelo IRRF.',
  },
  '1099': {
    code: '1099',
    name: 'Outras verbas remuneratórias',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 457',
    justification: 'Verbas de natureza salarial diversa com incidência integral.',
  },
  '1201': {
    code: '1201',
    name: 'Gratificação de função / Cargo de confiança',
    inss: true,
    irrf: true,
    fgts: true,
    integra_dsr: false,
    inss_patronal: true,
    rat: true,
    terceiros: true,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 62 II e art. 224 §2º',
    justification: 'Contraprestação por responsabilidade superior; natureza estritamente salarial.',
  },
  '1401': {
    code: '1401',
    name: 'Salário-família',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'Lei 8.213/1991 art. 65',
    justification: 'Benefício previdenciário pago pela empresa e compensado no GPS/DARF; totalmente isento.',
  },
  '2000': {
    code: '2000',
    name: 'Ajuda de custo / Diárias indenizatórias',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 457 §2º',
    justification: 'Verba ressarcitória/indenizatória; sem incidências tributárias nem encargos trabalhistas.',
  },
  '2501': {
    code: '2501',
    name: 'Participação nos Lucros ou Resultados - PLR',
    inss: false,
    irrf: true,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'TABELA_PLR',
    legal_basis: 'Lei 10.101/2000; CF/88 art. 7º XI',
    justification: 'Desvinculada da remuneração; isenta de previdência e FGTS; tributada exclusivamente na fonte por tabela progressiva anual própria.',
  },
  '9200': {
    code: '9200',
    name: 'Desconto de Vale-transporte',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'Lei 7.418/1985 art. 4º',
    justification: 'Desconto legal de até 6% do salário básico a título de transporte.',
  },
  '9210': {
    code: '9210',
    name: 'Desconto de Vale-refeição / PAT',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'Lei 6.321/1976 (PAT)',
    justification: 'Coparticipação do colaborador em benefício de alimentação cadastrado no PAT.',
  },
  '9214': {
    code: '9214',
    name: 'Desconto de Assistência Médica / Odontológica',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 458 §2º IV',
    justification: 'Coparticipação ou mensalidade de plano de saúde expressamente autorizada.',
  },
  '9219': {
    code: '9219',
    name: 'Desconto de Faltas e Atrasos',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 473; Lei 605/1949 art. 6º',
    justification: 'Desconto de horas não trabalhadas injustificadamente.',
  },
  '9900': {
    code: '9900',
    name: 'Descontos diversos / Convênios autorizados',
    inss: false,
    irrf: false,
    fgts: false,
    integra_dsr: false,
    inss_patronal: false,
    rat: false,
    terceiros: false,
    irrf_mode: 'NORMAL',
    legal_basis: 'CLT art. 462; Súmula 342 TST',
    justification: 'Descontos contratuais autorizados de forma prévia e expressa pelo colaborador.',
  },
};

export function getEsocialNatureSuggestion(code: string): EsocialNatureInfo | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim();
  return ESOCIAL_NATURE_SUGGESTIONS[cleanCode];
}

/**
 * Extrai identificadores de variáveis de uma fórmula excluindo funções nativas.
 */
export function extractFormulaVariables(formula: string): string[] {
  if (!formula || formula.trim() === '') return [];

  // Remove strings/literais se houver e normaliza
  const knownFunctions = new Set(['MIN', 'MAX', 'IF', 'ROUND']);
  const regex = /[A-Za-z_][A-Za-z0-9_]*/g;
  const matches = formula.match(regex) || [];

  const vars = new Set<string>();
  for (const token of matches) {
    const upper = token.toUpperCase();
    if (!knownFunctions.has(upper)) {
      vars.add(upper);
    }
  }

  return Array.from(vars);
}

/**
 * Simula o cálculo de uma rubrica com colaborador de teste.
 */
export function simulateRubricCalculation(
  config: RubricConfig,
  employee: SimulationEmployeeContext,
): SimulationResult {
  try {
    let calculatedAmount = 0;
    let calculationMemory = '';

    const form = config.calculation_form || 'FIXO';

    if (form === 'FIXO') {
      const val = config.quantity ?? config.percentage ?? config.factor ?? 0;
      calculatedAmount = round2(val);
      calculationMemory = `Valor fixo informado: R$ ${calculatedAmount.toFixed(2).replace('.', ',')}`;
    } else if (form === 'PERCENTUAL') {
      const baseName = config.calculation_base || 'SALARY';
      let baseValue = employee.salary;
      if (baseName === 'MINIMUM_WAGE') {
        baseValue = employee.minimum_wage;
      } else if (employee.custom_variables && employee.custom_variables[baseName] !== undefined) {
        baseValue = employee.custom_variables[baseName];
      }

      const perc = config.percentage ?? 0;
      calculatedAmount = round2((baseValue * perc) / 100);
      calculationMemory = `${perc}% sobre ${baseName} (R$ ${baseValue.toFixed(2).replace('.', ',')}) = R$ ${calculatedAmount.toFixed(2).replace('.', ',')}`;
    } else if (form === 'FORMULA') {
      const formulaStr = config.formula || '';
      if (!formulaStr.trim()) {
        throw new FormulaError('Fórmula não pode estar vazia');
      }

      // Prepara o contexto de variáveis
      const vars: Record<string, number> = {
        SALARY: employee.salary,
        MINIMUM_WAGE: employee.minimum_wage,
        DIVISOR: config.divisor ?? employee.divisor ?? 220,
        FACTOR: config.factor ?? employee.factor ?? 1.0,
        QUANTITY: config.quantity ?? employee.quantity ?? 1.0,
        DIAS_UTEIS: employee.dias_uteis ?? 24,
        DIAS_INUTEIS: employee.dias_inuteis ?? 4,
        BASE_DSR: employee.custom_variables?.BASE_DSR ?? 0,
        BASE_HORA_EXTRA: employee.custom_variables?.BASE_HORA_EXTRA ?? employee.salary,
        ...(employee.custom_variables || {}),
      };

      const parser = new RubricFormulaParser(vars);
      calculatedAmount = parser.evaluate(formulaStr);

      calculationMemory = `Expressão: ${formulaStr}\nResultado avaliado: R$ ${calculatedAmount.toFixed(2).replace('.', ',')}`;
    }

    const isEarning = config.type === 'EARNING';
    const netImpact = isEarning ? calculatedAmount : -calculatedAmount;

    const incidences = config.incidences || {
      inss: false,
      irrf: false,
      fgts: false,
      integra_dsr: false,
    };

    const taxImpact = {
      inss: incidences.inss ? calculatedAmount : 0,
      irrf: incidences.irrf ? calculatedAmount : 0,
      fgts: incidences.fgts ? calculatedAmount : 0,
      dsr: incidences.integra_dsr ? calculatedAmount : 0,
    };

    return {
      success: true,
      calculatedAmount,
      calculationMemory,
      taxImpact,
      netImpact,
    };
  } catch (err: any) {
    return {
      success: false,
      calculatedAmount: 0,
      calculationMemory: 'Erro ao avaliar cálculo',
      taxImpact: { inss: 0, irrf: 0, fgts: 0, dsr: 0 },
      netImpact: 0,
      error: err?.message || 'Erro inesperado no cálculo',
    };
  }
}

/**
 * Validação rigorosa dos dados da rubrica antes de persistência.
 */
export function validateRubricConfig(
  config: RubricConfig,
  existingRubrics: Array<{ code: string; name: string; formula?: string }>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Código
  if (!config.code || !config.code.trim()) {
    errors.push('Código da rubrica é obrigatório.');
  } else {
    const cleanCode = config.code.trim();
    const duplicate = existingRubrics.find((r) => r.code === cleanCode && (!config.id || r.code !== cleanCode));
    if (duplicate && duplicate.code === cleanCode) {
      errors.push(`O código '${cleanCode}' já está em uso pela rubrica '${duplicate.name}'.`);
    }
  }

  // 2. Nome
  if (!config.name || !config.name.trim()) {
    errors.push('Nome da rubrica é obrigatório.');
  }

  // 3. rubric_kind
  if (!config.rubric_kind) {
    errors.push('Tipo do motor (rubric_kind) é obrigatório.');
  }

  // 4. Tipo
  if (!config.type || !['EARNING', 'DEDUCTION'].includes(config.type)) {
    errors.push('Tipo de evento deve ser Provento (EARNING) ou Desconto (DEDUCTION).');
  }

  // 5. Forma de cálculo e validação de Fórmula / Variáveis
  const form = config.calculation_form || 'FIXO';
  if (form === 'PERCENTUAL') {
    if (config.percentage === undefined || config.percentage === null || config.percentage <= 0) {
      errors.push('Para forma percentual, informe um percentual maior que zero.');
    }
  } else if (form === 'FORMULA') {
    if (!config.formula || !config.formula.trim()) {
      errors.push('Fórmula de cálculo é obrigatória.');
    } else {
      const formulaStr = config.formula.trim();
      const extractedVars = extractFormulaVariables(formulaStr);

      // Validação sintática
      try {
        const dummyVars: Record<string, number> = {};
        for (const v of extractedVars) {
          dummyVars[v] = 1;
        }
        const parser = new RubricFormulaParser(dummyVars);
        parser.evaluate(formulaStr);
      } catch (err: any) {
        errors.push(`Sintaxe da fórmula inválida: ${err?.message || 'erro de parser'}`);
      }

      // Variáveis permitidas
      const allowedVars = new Set<string>([...PUBLISHED_VARIABLES]);
      // Rubricas do catálogo como R{code}
      for (const r of existingRubrics) {
        allowedVars.add(`R${r.code}`);
      }

      for (const v of extractedVars) {
        if (!allowedVars.has(v)) {
          // Verifica se parece com R{code}
          if (v.startsWith('R') && /^\d+$/.test(v.slice(1))) {
            const referencedCode = v.slice(1);
            if (!existingRubrics.some((r) => r.code === referencedCode)) {
              errors.push(`A variável '${v}' faz referência ao código '${referencedCode}', inexistente no catálogo.`);
            }
          } else {
            errors.push(`A variável '${v}' não é uma variável publicada permitida.`);
          }
        }
      }

      // Detecção de dependência circular
      const currentCode = config.code?.trim();
      if (currentCode) {
        const referencedCodes = extractedVars
          .filter((v) => v.startsWith('R') && /^\d+$/.test(v.slice(1)))
          .map((v) => v.slice(1));

        // BFS / DFS para detectar ciclo
        const visited = new Set<string>();
        const queue = [...referencedCodes];
        let hasCycle = false;

        while (queue.length > 0) {
          const next = queue.shift()!;
          if (next === currentCode) {
            hasCycle = true;
            break;
          }
          if (!visited.has(next)) {
            visited.add(next);
            const parent = existingRubrics.find((r) => r.code === next);
            if (parent && parent.formula) {
              const parentVars = extractFormulaVariables(parent.formula);
              const parentRefs = parentVars
                .filter((v) => v.startsWith('R') && /^\d+$/.test(v.slice(1)))
                .map((v) => v.slice(1));
              queue.push(...parentRefs);
            }
          }
        }

        if (hasCycle) {
          errors.push(`Ciclo de dependência detectado: a fórmula da rubrica ${currentCode} depende de si mesma direta ou indiretamente.`);
        }
      }
    }
  }

  // 6. Validação jurídica / eSocial
  if (config.esocial_nature === '2501' && config.incidences?.inss) {
    errors.push('A Lei 10.101/2000 proíbe incidência de INSS sobre PLR (natureza 2501).');
  }

  if (config.esocial_nature === '2000' && (config.incidences?.inss || config.incidences?.fgts)) {
    warnings.push('A natureza 2000 (Ajuda de Custo / Diárias) possui caráter estritamente indenizatório (CLT art. 457 §2º) e normalmente não gera INSS ou FGTS.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Cria uma nova versão para uma rubrica ativa respeitando imutabilidade.
 */
export function createNewRubricVersion(
  activeRubric: any,
  updates: Partial<RubricConfig>,
  approvedByUserId?: string,
): any {
  const currentVersion = activeRubric.version || 1;
  return {
    ...activeRubric,
    ...updates,
    id: undefined, // novo registro no banco
    previous_version_id: activeRubric.id,
    version: currentVersion + 1,
    status: 'APPROVED',
    approved_by: approvedByUserId || null,
    approved_at: new Date().toISOString(),
    valid_from: updates.valid_from || new Date().toISOString().split('T')[0],
  };
}
