export interface Rubric {
  id: string;
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'NEUTRAL';
  category: string;
  calculation_form: string;
  calculation_base?: string;
  percentage?: number;
  quantity?: number;
  divisor?: number;
  factor?: number;
  formula?: string;
  calculation_order: number;
  incidencias: {
    inss: boolean;
    irrf: boolean;
    fgts: boolean;
    inss_patronal: boolean;
    rat: boolean;
    terceiros: boolean;
    gera_base_inss: boolean;
    gera_base_irrf: boolean;
    gera_base_fgts: boolean;
  };
}

export interface PayrollEvent {
  id: string;
  rubric_id: string;
  quantity?: number;
  reference?: string;
  manual_value?: number;
  origin: string;
}

export interface CalculationMemory {
  rubric_id: string;
  step_name: string;
  base_value: number;
  quantity_used: number;
  percentage_used: number;
  parsed_formula: string;
  result_value: number;
  origin: string;
}

export interface CalculationResult {
  total_proventos: number;
  total_descontos: number;
  total_inss: number;
  total_irrf: number;
  total_fgts: number;
  total_encargos_patronais: number;
  liquido: number;
  bases: {
    inss: number;
    irrf: number;
    fgts: number;
  };
  memoria_calculo: CalculationMemory[];
  status: string;
}

export interface InssBracket {
  bracket_number: number;
  base_limit: number | null;
  aliquot: number;
  deduction: number;
}

export interface IrrfBracket {
  bracket_number: number;
  base_limit: number | null;
  aliquot: number;
  deduction: number;
}

export interface GeneralLegalParameters {
  minimum_wage?: number;
  dependent_deduction?: number;
  simplified_discount?: number;
  family_salary_quota?: number;
  family_salary_limit?: number;
  fgts_standard_aliquot?: number;
  fgts_apprentice_aliquot?: number;
  irrf_exemption_limit?: number;
  irrf_reduction_formula_limit?: number;
  irrf_base_reduction?: number;
}

export interface PayrollContextData {
  competencia: string; 
  tipo_folha: string;
  empregado_id: string;
  contrato_id: string;
  salario_base: number;
  dias_trabalhados: number;
  dias_uteis: number;
  dias_inuteis: number;
  divisor: number;
  num_dependentes?: number;
  rubricas: Rubric[];
  eventos: PayrollEvent[];
  contract_incidences?: any;
  inss_parameters?: InssBracket[];
  irrf_parameters?: IrrfBracket[];
  general_legal_parameters?: GeneralLegalParameters;
}

export class PayrollContext {
  competencia: string;
  tipo_folha: string;
  empregado_id: string;
  contrato_id: string;
  salario_base: number;
  dias_trabalhados: number;
  dias_uteis: number;
  dias_inuteis: number;
  divisor: number;
  salario_minimo: number;
  rubricas: Map<string, Rubric>;
  eventos: PayrollEvent[];
  contract_incidences?: any;
  inss_parameters?: InssBracket[];
  irrf_parameters?: IrrfBracket[];
  general_legal_parameters?: GeneralLegalParameters;
  
  // Variables tracking
  variables: Record<string, number>;
  
  // Variáveis Acumuladoras Globais (Estado da Máquina)
  base_inss: number = 0;
  base_irrf: number = 0;
  base_fgts: number = 0;

  total_proventos: number = 0;
  total_descontos: number = 0;

  memoria: CalculationMemory[] = [];

  constructor(data: any) {
    this.competencia = data.competencia;
    this.tipo_folha = data.tipo_folha;
    this.empregado_id = data.empregado_id;
    this.contrato_id = data.contrato_id;
    this.salario_base = data.salario_base || 0;
    this.dias_trabalhados = data.dias_trabalhados || 30;
    this.dias_uteis = data.dias_uteis || 26;
    this.dias_inuteis = data.dias_inuteis || 4;
    this.divisor = data.divisor || 220;
    this.salario_minimo = data.salario_minimo || 1621;
    this.rubricas = new Map((data.rubricas || []).map((r: Rubric) => [r.id, r]));
    this.eventos = data.eventos || [];
    this.contract_incidences = data.contract_incidences || null;
    this.inss_parameters = data.inss_parameters || [];
    this.irrf_parameters = data.irrf_parameters || [];
    this.general_legal_parameters = data.general_legal_parameters || {};

    this.memoria = [];  
    this.variables = {
      'SALARIO_BASE': this.salario_base,
      'SALARIO_MINIMO': this.salario_minimo,
      'SALARIO_CONTRATUAL': this.salario_base,
      'DIAS_TRABALHADOS': this.dias_trabalhados,
      'HORAS_TRABALHADAS': 220,
      'DIAS_UTEIS': data.dias_uteis || 26,
      'DIAS_INUTEIS': data.dias_inuteis || 4,
      'DIVISOR': data.divisor || 220,
      'DEPENDENTES': data.num_dependentes || 0,
    };
  }

  setVariable(name: string, value: number) {
    this.variables[name] = value;
  }

  getVariable(name: string): number {
    return this.variables[name] || 0;
  }

  addMemory(mem: CalculationMemory) {
    this.memoria.push(mem);
  }
}
