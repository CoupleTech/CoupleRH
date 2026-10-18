// src/tests/fixtures/goldenPayslipCases.ts
import type { Rubric, PayrollEvent } from '../../../supabase/functions/payroll-engine/engine/PayrollContext.ts';
import {
  testInssBrackets,
  testIrrfBrackets,
  testGeneralLegalParameters,
  standardSystemRubrics
} from './legalParameters.ts';

export interface GoldenTestCase {
  id: string;
  title: string;
  category: string;
  legalBasis: string;
  description: string;
  contextInput: {
    salario_base: number;
    dias_trabalhados?: number;
    dias_uteis?: number;
    dias_inuteis?: number;
    divisor?: number;
    num_dependentes?: number;
    is_apprentice?: boolean;
    allow_cumulative_hazard_allowances?: boolean;
    base_inss_already_taxed?: number;
    tipo_folha?: string;
  };
  customRubrics?: Rubric[];
  events?: PayrollEvent[];
  expected: {
    total_proventos: number;
    total_descontos: number;
    liquido: number;
    inss: number;
    irrf: number;
    fgts: number;
    bases?: {
      inss?: number;
      irrf?: number;
      fgts?: number;
    };
  };
}

// Catálogo Padrão de Rubricas CLT para os Golden Tests
export const goldenStandardRubrics: Rubric[] = [
  {
    id: 'rub-101',
    code: '101',
    name: 'Salário Base Contratual',
    type: 'EARNING',
    category: 'SALARY',
    rubric_kind: 'SALARY_BASE',
    calculation_form: 'DIAS',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 10,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-150',
    code: '150',
    name: 'Horas Extras 50%',
    type: 'EARNING',
    category: 'OVERTIME',
    rubric_kind: 'OVERTIME',
    calculation_form: 'HORAS',
    calculation_base: 'BASE_HORA_EXTRA',
    factor: 1.5,
    divisor: 220,
    calculation_order: 20,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-160',
    code: '160',
    name: 'Horas Extras 100%',
    type: 'EARNING',
    category: 'OVERTIME',
    rubric_kind: 'OVERTIME',
    calculation_form: 'HORAS',
    calculation_base: 'BASE_HORA_EXTRA',
    factor: 2.0,
    divisor: 220,
    calculation_order: 21,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-104',
    code: '104',
    name: 'DSR sobre Horas Extras',
    type: 'EARNING',
    category: 'OVERTIME',
    rubric_kind: 'DSR',
    calculation_form: 'FORMULA',
    calculation_base: 'BASE_DSR',
    calculation_order: 30,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-180',
    code: '180',
    name: 'Adicional Noturno 20%',
    type: 'EARNING',
    category: 'ALLOWANCE',
    rubric_kind: 'ADIC_NOTURNO',
    calculation_form: 'HORAS',
    calculation_base: 'SALARIO_BASE',
    percentage: 20,
    divisor: 220,
    calculation_order: 25,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-171',
    code: '171',
    name: 'DSR sobre Adicional Noturno',
    type: 'EARNING',
    category: 'ALLOWANCE',
    rubric_kind: 'DSR_NOTURNO',
    calculation_form: 'FORMULA',
    calculation_base: 'BASE_DSR_NOTURNO',
    calculation_order: 31,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-302',
    code: '302',
    name: 'Adicional de Insalubridade',
    type: 'EARNING',
    category: 'ALLOWANCE',
    rubric_kind: 'INSALUBRIDADE',
    calculation_form: 'PERCENTUAL',
    calculation_base: 'SALARIO_MINIMO',
    percentage: 20,
    calculation_order: 15,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-303',
    code: '303',
    name: 'Adicional de Periculosidade',
    type: 'EARNING',
    category: 'ALLOWANCE',
    rubric_kind: 'PERICULOSIDADE',
    calculation_form: 'PERCENTUAL',
    calculation_base: 'SALARIO_BASE',
    percentage: 30,
    calculation_order: 16,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-801',
    code: '801',
    name: 'Faltas Injustificadas',
    type: 'DEDUCTION',
    category: 'OTHER',
    rubric_kind: 'ABSENCE',
    calculation_form: 'DIAS',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 40,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-803',
    code: '803',
    name: 'DSR sobre Faltas',
    type: 'DEDUCTION',
    category: 'OTHER',
    rubric_kind: 'ABSENCE',
    calculation_form: 'DIAS',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 41,
    incidencias: {
      inss: true, irrf: true, fgts: true,
      inss_patronal: true, rat: true, terceiros: true,
      gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
    }
  },
  {
    id: 'rub-804',
    code: '804',
    name: 'Pensão Alimentícia Judicial',
    type: 'DEDUCTION',
    category: 'OTHER',
    rubric_kind: 'ALIMONY',
    calculation_form: 'VALOR_FIXO',
    calculation_order: 85,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  },
  {
    id: 'rub-805',
    code: '805',
    name: 'Empréstimo Consignado',
    type: 'DEDUCTION',
    category: 'OTHER',
    rubric_kind: 'LOAN',
    calculation_form: 'VALOR_FIXO',
    calculation_order: 86,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  },
  {
    id: 'rub-407',
    code: '407',
    name: 'Estorno Provisão Consignado',
    type: 'EARNING',
    category: 'OTHER',
    rubric_kind: 'OTHER',
    calculation_form: 'VALOR_FIXO',
    calculation_order: 87,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  },
  {
    id: 'rub-250',
    code: '250',
    name: 'Adiantamento Salarial',
    type: 'DEDUCTION',
    category: 'ADVANCE',
    rubric_kind: 'ADVANCE',
    calculation_form: 'VALOR_FIXO',
    calculation_order: 88,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  },
  {
    id: 'rub-201',
    code: '201',
    name: 'Desconto Vale Transporte (6%)',
    type: 'DEDUCTION',
    category: 'BENEFIT',
    rubric_kind: 'BENEFIT',
    calculation_form: 'VALOR_FIXO',
    calculation_order: 89,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  },
  // Rubricas de Impostos Oficiais
  ...standardSystemRubrics.map(r => ({
    ...r,
    rubric_kind: (r.code === '901' ? 'INSS' : r.code === '902' ? 'IRRF' : 'FGTS') as any,
    incidencias: {
      inss: false, irrf: false, fgts: false,
      inss_patronal: false, rat: false, terceiros: false,
      gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false
    }
  }))
];

export const GOLDEN_PAYSLIP_CASES: GoldenTestCase[] = [
  // -------------------------------------------------------------
  // GRUPO 1: LIMITES DE FAIXAS E TETOS DO INSS (2026)
  // -------------------------------------------------------------
  {
    id: 'GF-01',
    title: 'Salário Mínimo 2026 (R$ 1.621,00) - Padrão CLT 220h',
    category: 'Faixas do INSS',
    legalBasis: 'CLT art. 76, CF art. 7º IV, Portaria Interministerial MPS/MF 2026',
    description: 'Trabalhador remunerado pelo piso nacional. Retenção de 7.5% de INSS, 0 dependentes, isenção total de IRRF e FGTS 8%.',
    contextInput: { salario_base: 1621.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 1621.00,
      total_descontos: 121.57,
      liquido: 1499.43,
      inss: 121.57,
      irrf: 0.00,
      fgts: 129.68,
      bases: { inss: 1621.00, fgts: 1621.00 }
    }
  },
  {
    id: 'GF-02',
    title: 'Limite Superior Exato da Faixa 1 do INSS (R$ 1.621,00)',
    category: 'Faixas do INSS',
    legalBasis: 'Tabela Progressiva INSS 2026 - Faixa 1',
    description: 'Validação de fronteira exata da primeira faixa de incidência do INSS.',
    contextInput: { salario_base: 1621.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 1621.00,
      total_descontos: 121.57,
      liquido: 1499.43,
      inss: 121.57,
      irrf: 0.00,
      fgts: 129.68
    }
  },
  {
    id: 'GF-03',
    title: 'Limite Superior Exato da Faixa 2 do INSS (R$ 2.902,84)',
    category: 'Faixas do INSS',
    legalBasis: 'Tabela Progressiva INSS 2026 - Faixa 2',
    description: 'Remuneração na fronteira da 2ª faixa do INSS. Faixa 1 (121,575) + Faixa 2 (1.281,84 * 9% = 115,3656). Total INSS R$ 236,94.',
    contextInput: { salario_base: 2902.84, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 2902.84,
      total_descontos: 236.94,
      liquido: 2665.90,
      inss: 236.94,
      irrf: 0.00,
      fgts: 232.23
    }
  },
  {
    id: 'GF-04',
    title: 'Limite Superior Exato da Faixa 3 do INSS (R$ 4.354,27)',
    category: 'Faixas do INSS',
    legalBasis: 'Tabela Progressiva INSS 2026 - Faixa 3',
    description: 'Remuneração na fronteira da 3ª faixa do INSS. Faixas 1, 2 e 3 somadas com precisão contábil. Total INSS R$ 411,11.',
    contextInput: { salario_base: 4354.27, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 4354.27,
      total_descontos: 411.11,
      liquido: 3943.16,
      inss: 411.11,
      irrf: 0.00,
      fgts: 348.34
    }
  },
  {
    id: 'GF-05',
    title: 'Teto Máximo Previdenciário do INSS (R$ 8.475,55)',
    category: 'Faixas do INSS',
    legalBasis: 'Tabela Progressiva INSS 2026 - Teto Máximo R$ 8.475,55',
    description: 'Remuneração no teto do INSS. INSS atinge a cota máxima histórica de R$ 988,09. IRRF calculado pela dedução legal (7.487,46 * 27.5% - 908,73 = 1.150,32).',
    contextInput: { salario_base: 8475.55, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 8475.55,
      total_descontos: 2138.41,
      liquido: 6337.14,
      inss: 988.09,
      irrf: 1150.32,
      fgts: 678.04
    }
  },
  {
    id: 'GF-06',
    title: 'Salário R$ 12.000,00 - Superando o Teto Previdenciário (Doc §4 T1)',
    category: 'Faixas do INSS',
    legalBasis: 'Doc §4 T1 - Caso de Homologação Oficial de Teto e IRRF',
    description: 'Remuneração bem superior ao teto do INSS. Contribuição previdenciária travada em R$ 988,09. IRRF na alíquota máxima de 27.5% = R$ 2.119,55.',
    contextInput: { salario_base: 12000.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 12000.00,
      total_descontos: 3107.64,
      liquido: 8892.36,
      inss: 988.09,
      irrf: 2119.55,
      fgts: 960.00
    }
  },
  {
    id: 'GF-07',
    title: 'Remuneração Executiva C-Level (R$ 25.000,00)',
    category: 'Faixas do INSS',
    legalBasis: 'CLT e Legislação Tributária Federal IRPF 2026',
    description: 'Salário alto com teto de INSS R$ 988,09 e tributação de 27.5% sobre base de R$ 24.011,91 (IRRF R$ 5.694,55).',
    contextInput: { salario_base: 25000.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 25000.00,
      total_descontos: 6682.64,
      liquido: 18317.36,
      inss: 988.09,
      irrf: 5694.55,
      fgts: 2000.00
    }
  },

  // -------------------------------------------------------------
  // GRUPO 2: FAIXAS DE IRRF E REDUTOR 2026 (LEI 15.270/2025)
  // -------------------------------------------------------------
  {
    id: 'GF-08',
    title: 'Limite da Faixa Isenta da Tabela Ordinária do IRRF (R$ 2.428,80)',
    category: 'Tabela de IRRF',
    legalBasis: 'Tabela Progressiva IRRF 2026 - Faixa 1 (Alíquota 0%)',
    description: 'Salário na fronteira da primeira faixa do IRRF. Isenção natural por tabela.',
    contextInput: { salario_base: 2428.80, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 2428.80,
      total_descontos: 194.28,
      liquido: 2234.52,
      inss: 194.28,
      irrf: 0.00,
      fgts: 194.30
    }
  },
  {
    id: 'GF-09',
    title: 'Limite Máximo de Isenção Completa 2026 com Redutor (R$ 5.000,00) - Doc §4 T1',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 art. 1º, Doc §4 T1',
    description: 'Salário bruto de R$ 5.000,00. O redutor integral zera qualquer retenção de IRRF (R$ 0,00).',
    contextInput: { salario_base: 5000.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 5000.00,
      total_descontos: 501.51,
      liquido: 4498.49,
      inss: 501.51,
      irrf: 0.00,
      fgts: 400.00
    }
  },
  {
    id: 'GF-10',
    title: 'Início da Faixa de Transição do Redutor 2026 (R$ 5.300,00) - Doc §4 T1',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 art. 1º, Doc §4 T1',
    description: 'Salário bruto na faixa de transição. Redutor = 978,62 - (0,133145 * 5.300,00) = R$ 272,95. IRRF final R$ 108,84.',
    contextInput: { salario_base: 5300.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 5300.00,
      total_descontos: 652.35,
      liquido: 4647.65,
      inss: 543.51,
      irrf: 108.84,
      fgts: 424.00
    }
  },
  {
    id: 'GF-11',
    title: 'Ponto Médio da Transição do Redutor 2026 (R$ 6.000,00) - Doc §4 T1',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 art. 1º, Doc §4 T1',
    description: 'Salário bruto R$ 6.000,00. INSS R$ 641,51 e IRRF com redutor de transição = R$ 385,10.',
    contextInput: { salario_base: 6000.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 6000.00,
      total_descontos: 1026.61,
      liquido: 4973.39,
      inss: 641.51,
      irrf: 385.10,
      fgts: 480.00
    }
  },
  {
    id: 'GF-12',
    title: 'Transição Intermediária Alta do Redutor 2026 (R$ 7.000,00) - Doc §4 T1',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 art. 1º, Doc §4 T1',
    description: 'Salário bruto R$ 7.000,00. INSS R$ 781,51 e IRRF com redutor de transição = R$ 754,75.',
    contextInput: { salario_base: 7000.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 7000.00,
      total_descontos: 1536.26,
      liquido: 5463.74,
      inss: 781.51,
      irrf: 754.75,
      fgts: 560.00
    }
  },
  {
    id: 'GF-13',
    title: 'Limite Superior Exato da Fórmula do Redutor (R$ 7.350,00) - Doc §4 T1',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 art. 1º, Doc §4 T1',
    description: 'Último centavo de elegibilidade ao redutor de 2026. INSS R$ 830,51 e IRRF R$ 884,13.',
    contextInput: { salario_base: 7350.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 7350.00,
      total_descontos: 1714.64,
      liquido: 5635.36,
      inss: 830.51,
      irrf: 884.13,
      fgts: 588.00
    }
  },
  {
    id: 'GF-14',
    title: 'Salário Imediatamente Superior ao Limite do Redutor (R$ 7.500,00) - Sem Redutor',
    category: 'Redutor IRRF 2026',
    legalBasis: 'Lei 15.270/2025 e Tabela Ordinária IRRF 2026',
    description: 'Bruto acima de R$ 7.350,00. Não incide redutor 2026. Base legal = 7.500,00 - 851,51 = 6.648,49. IRRF = R$ 919,60.',
    contextInput: { salario_base: 7500.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 7500.00,
      total_descontos: 1771.11,
      liquido: 5728.89,
      inss: 851.51,
      irrf: 919.60,
      fgts: 600.00
    }
  },

  // -------------------------------------------------------------
  // GRUPO 3: DEDUÇÕES DE DEPENDENTES E COMPARATIVO COM SIMPLIFICADA
  // -------------------------------------------------------------
  {
    id: 'GF-15',
    title: 'Salário R$ 3.000,00 com 1 Dependente Legal (R$ 189,59)',
    category: 'Dependentes',
    legalBasis: 'Lei 9.250/1995 art. 4º III (Dedução de R$ 189,59/mês por dependente)',
    description: 'Trabalhador com 1 filho menor. Salário na 3ª faixa do INSS (248,60). IRRF zerado.',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 30, num_dependentes: 1 },
    expected: {
      total_proventos: 3000.00,
      total_descontos: 248.60,
      liquido: 2751.40,
      inss: 248.60,
      irrf: 0.00,
      fgts: 240.00
    }
  },
  {
    id: 'GF-16',
    title: 'Salário R$ 5.500,00 com 1 Dependente Legal',
    category: 'Dependentes',
    legalBasis: 'Lei 9.250/1995 e Lei 15.270/2025',
    description: 'Salário na transição do redutor. O abatimento de 1 dependente reduz a base legal de IRRF gerando imposto apurado de R$ 148,15.',
    contextInput: { salario_base: 5500.00, dias_trabalhados: 30, num_dependentes: 1 },
    expected: {
      total_proventos: 5500.00,
      total_descontos: 719.66,
      liquido: 4780.34,
      inss: 571.51,
      irrf: 148.15,
      fgts: 440.00
    }
  },
  {
    id: 'GF-17',
    title: 'Salário R$ 6.000,00 com 2 Dependentes Legais (R$ 379,18 de dedução)',
    category: 'Dependentes',
    legalBasis: 'Lei 9.250/1995 e Lei 15.270/2025',
    description: '2 dependentes abatendo R$ 379,18 da base de cálculo do IRRF, resultando em IRRF de R$ 280,83.',
    contextInput: { salario_base: 6000.00, dias_trabalhados: 30, num_dependentes: 2 },
    expected: {
      total_proventos: 6000.00,
      total_descontos: 922.34,
      liquido: 5077.66,
      inss: 641.51,
      irrf: 280.83,
      fgts: 480.00
    }
  },
  {
    id: 'GF-18',
    title: 'Salário R$ 7.000,00 com 3 Dependentes Legais (R$ 568,77 de dedução)',
    category: 'Dependentes',
    legalBasis: 'Lei 9.250/1995 e Lei 15.270/2025',
    description: '3 dependentes totalizando dedução de R$ 568,77 no IRRF, resultando em IRRF de R$ 598,34.',
    contextInput: { salario_base: 7000.00, dias_trabalhados: 30, num_dependentes: 3 },
    expected: {
      total_proventos: 7000.00,
      total_descontos: 1379.85,
      liquido: 5620.15,
      inss: 781.51,
      irrf: 598.34,
      fgts: 560.00
    }
  },

  // -------------------------------------------------------------
  // GRUPO 4: JORNADA, HORAS EXTRAS E REFLEXOS DE DSR
  // -------------------------------------------------------------
  {
    id: 'GF-19',
    title: 'Horas Extras 50% (20h, Divisor 220, Salário R$ 3.300,00) + DSR',
    category: 'Horas Extras e DSR',
    legalBasis: 'CLT art. 59 § 1º, CF art. 7º XVI e Lei 605/1949 art. 7º',
    description: 'Salário R$ 3.300,00. Hora normal R$ 15,00. 20 HE 50% (R$ 22,50/h) = R$ 450,00. DSR (4 dom/24 úteis) = R$ 75,00. Bruto R$ 3.825,00.',
    contextInput: { salario_base: 3300.00, dias_trabalhados: 30, dias_uteis: 24, dias_inuteis: 4, divisor: 220, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-150', quantity: 20, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3825.00,
      total_descontos: 347.60,
      liquido: 3477.40,
      inss: 347.60,
      irrf: 0.00,
      fgts: 306.00,
      bases: { inss: 3825.00, fgts: 3825.00 }
    }
  },
  {
    id: 'GF-20',
    title: 'Horas Extras 100% em Domingos/Feriados (10h, Divisor 220, Salário R$ 2.200,00) + DSR',
    category: 'Horas Extras e DSR',
    legalBasis: 'CLT art. 59 § 1º, Lei 605/1949 e Súmula 172 TST',
    description: 'Salário R$ 2.200,00. Hora normal R$ 10,00. 10 HE 100% (R$ 20,00/h) = R$ 200,00. DSR (5 dom/25 úteis = 20%) = R$ 40,00. Bruto R$ 2.440,00.',
    contextInput: { salario_base: 2200.00, dias_trabalhados: 30, dias_uteis: 25, dias_inuteis: 5, divisor: 220, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-160', quantity: 10, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 2440.00,
      total_descontos: 195.28,
      liquido: 2244.72,
      inss: 195.28,
      irrf: 0.00,
      fgts: 195.20
    }
  },
  {
    id: 'GF-21',
    title: 'Adicional Noturno Urbano (Redução Ficta 60/52.5) e DSR Noturno',
    category: 'Horas Extras e DSR',
    legalBasis: 'CLT art. 73 § 1º e § 2º (fator 1.142857 e 20% adicional) e Súmula 60 TST',
    description: 'Salário R$ 3.000,00, divisor 220. 42h noturnas com redução legal e reflexo de DSR Noturno.',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 30, dias_uteis: 24, dias_inuteis: 4, divisor: 220, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-180', quantity: 42, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3133.64,
      total_descontos: 264.64,
      liquido: 2869.00,
      inss: 264.64,
      irrf: 0.00,
      fgts: 250.69
    }
  },
  {
    id: 'GF-22',
    title: 'Horas Extras com Súmula 264 do TST (Insalubridade integrando a Base da HE)',
    category: 'Horas Extras e DSR',
    legalBasis: 'Súmula 264 do TST (A remuneração do serviço suplementar é composta do valor da hora normal integrado por adicionais habituais)',
    description: 'Salário R$ 2.000,00 + Insalubridade R$ 324,20 = Base da HE R$ 2.324,20. 10 HE 50% = R$ 158,47 + DSR (4/24) R$ 26,41. Bruto R$ 2.509,08.',
    contextInput: { salario_base: 2000.00, dias_trabalhados: 30, dias_uteis: 24, dias_inuteis: 4, divisor: 220, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-302', quantity: 1, origin: 'MANUAL' },
      { rubric_id: 'rub-150', quantity: 10, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 2509.08,
      total_descontos: 201.50,
      liquido: 2307.58,
      inss: 201.50,
      irrf: 0.00,
      fgts: 200.73
    }
  },

  // -------------------------------------------------------------
  // GRUPO 5: ADICIONAIS OCUPACIONAIS E NÃO CUMULATIVIDADE (CLT ART. 193 § 2º)
  // -------------------------------------------------------------
  {
    id: 'GF-23',
    title: 'Adicional de Insalubridade Grau Mínimo (10% sobre Salário Mínimo R$ 1.621,00)',
    category: 'Adicionais Ocupacionais',
    legalBasis: 'CLT art. 192 e Súmula Vinculante 4 do STF',
    description: 'Salário base R$ 2.500,00 + Insalubridade Grau Mínimo (10% de R$ 1.621,00 = R$ 162,10). Bruto R$ 2.662,10.',
    contextInput: { salario_base: 2500.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-302', quantity: 1, percentage: 10, value_type: 'PERCENT', origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 2662.10,
      total_descontos: 215.27,
      liquido: 2446.83,
      inss: 215.27,
      irrf: 0.00,
      fgts: 212.97
    }
  },
  {
    id: 'GF-24',
    title: 'Adicional de Insalubridade Grau Médio (20% sobre Salário Mínimo)',
    category: 'Adicionais Ocupacionais',
    legalBasis: 'CLT art. 192',
    description: 'Salário base R$ 2.500,00 + Insalubridade Grau Médio (20% de R$ 1.621,00 = R$ 324,20). Bruto R$ 2.824,20.',
    contextInput: { salario_base: 2500.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-302', quantity: 1, percentage: 20, value_type: 'PERCENT', origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 2824.20,
      total_descontos: 229.86,
      liquido: 2594.34,
      inss: 229.86,
      irrf: 0.00,
      fgts: 225.94
    }
  },
  {
    id: 'GF-25',
    title: 'Adicional de Insalubridade Grau Máximo (40% sobre Salário Mínimo)',
    category: 'Adicionais Ocupacionais',
    legalBasis: 'CLT art. 192',
    description: 'Salário base R$ 2.500,00 + Insalubridade Grau Máximo (40% de R$ 1.621,00 = R$ 648,40). Bruto R$ 3.148,40.',
    contextInput: { salario_base: 2500.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-302', quantity: 1, percentage: 40, value_type: 'PERCENT', origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3148.40,
      total_descontos: 266.41,
      liquido: 2881.99,
      inss: 266.41,
      irrf: 0.00,
      fgts: 251.87
    }
  },
  {
    id: 'GF-26',
    title: 'Adicional de Periculosidade (30% sobre Salário Base)',
    category: 'Adicionais Ocupacionais',
    legalBasis: 'CLT art. 193 § 1º e Súmula 191 do TST',
    description: 'Salário base R$ 4.000,00. Periculosidade 30% = R$ 1.200,00. Bruto R$ 5.200,00 na faixa de transição do redutor IRRF.',
    contextInput: { salario_base: 4000.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-303', quantity: 1, percentage: 30, value_type: 'PERCENT', origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 5200.00,
      total_descontos: 601.13,
      liquido: 4598.87,
      inss: 529.51,
      irrf: 71.62,
      fgts: 416.00
    }
  },
  {
    id: 'GF-27',
    title: 'Não Cumulatividade de Adicionais Ocupacionais (CLT art. 193 § 2º)',
    category: 'Adicionais Ocupacionais',
    legalBasis: 'CLT art. 193 § 2º e T14 Doc §4',
    description: 'Colaborador com Periculosidade (30% de 3.000 = 900,00) e Insalubridade (20% de 1.621 = 324,20). O motor elege o maior valor financeiro (Periculosidade).',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 30, allow_cumulative_hazard_allowances: false, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-302', quantity: 1, percentage: 20, value_type: 'PERCENT', origin: 'MANUAL' },
      { rubric_id: 'rub-303', quantity: 1, percentage: 30, value_type: 'PERCENT', origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3900.00,
      total_descontos: 356.60,
      liquido: 3543.40,
      inss: 356.60,
      irrf: 0.00,
      fgts: 312.00
    }
  },

  // -------------------------------------------------------------
  // GRUPO 6: FALTAS, DSR PERDIDO E DEDUÇÕES LEGAIS
  // -------------------------------------------------------------
  {
    id: 'GF-28',
    title: 'Faltas Injustificadas (2 dias) e Perda de DSR Correspondente',
    category: 'Faltas e DSR',
    legalBasis: 'CLT art. 473 e Lei 605/1949 art. 6º',
    description: 'Salário R$ 3.000,00 (R$ 100/dia). 2 dias de faltas (R$ 200,00) + 1 repouso semanal perdido (R$ 100,00). Reduz bases de INSS e FGTS para R$ 2.700,00.',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-801', quantity: 2, origin: 'MANUAL' },
      { rubric_id: 'rub-803', quantity: 1, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3000.00,
      total_descontos: 518.69,
      liquido: 2481.31,
      inss: 218.69,
      irrf: 0.00,
      fgts: 216.00,
      bases: { inss: 2700.00, fgts: 2700.00 }
    }
  },
  {
    id: 'GF-29',
    title: 'Pensão Alimentícia Judicial com Dedução da Base do IRRF (T17 Doc §4)',
    category: 'Deduções Especiais',
    legalBasis: 'Lei 9.250/1995 art. 4º II (Dedução integral da pensão alimentícia judicial da base de IRRF)',
    description: 'Salário R$ 7.000,00 com Pensão Judicial de R$ 1.000,00. A pensão abate R$ 1.000 da base do IRRF gerando economia fiscal legítima ao alimentante.',
    contextInput: { salario_base: 7000.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-804', manual_value: 1000.00, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 7000.00,
      total_descontos: 2261.26,
      liquido: 4738.74,
      inss: 781.51,
      irrf: 479.75,
      fgts: 560.00
    }
  },
  {
    id: 'GF-30',
    title: 'Empréstimo Consignado com Provisão no Adiantamento e Estorno na Folha Mensal',
    category: 'Consignados e Adiantamento',
    legalBasis: 'Lei 10.820/2003 e CLT art. 462',
    description: 'Salário R$ 4.000,00. Vale quinzenal R$ 1.600,00 (cód 250), parcela consignado R$ 400,00 (cód 805) e estorno da provisão retida no vale R$ 160,00 (cód 407).',
    contextInput: { salario_base: 4000.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-250', manual_value: 1600.00, origin: 'AUTOMATICA' },
      { rubric_id: 'rub-805', manual_value: 400.00, origin: 'AUTOMATICA' },
      { rubric_id: 'rub-407', manual_value: 160.00, origin: 'AUTOMATICA' }
    ],
    expected: {
      total_proventos: 4160.00,
      total_descontos: 2368.60,
      liquido: 1791.40,
      inss: 368.60,
      irrf: 0.00,
      fgts: 320.00
    }
  },

  // -------------------------------------------------------------
  // GRUPO 7: REGIMES ESPECIAIS, MENOR APRENDIZ E PROPORCIONALIDADE
  // -------------------------------------------------------------
  {
    id: 'GF-31',
    title: 'Menor Aprendiz - Alíquota Especial de FGTS 2% (T19 Doc §4)',
    category: 'Regimes Especiais',
    legalBasis: 'Lei 8.036/1990 art. 15 § 7º e CLT art. 428',
    description: 'Contrato com flag is_apprentice = true. Alíquota de FGTS reduzida de 8% para 2%. FGTS = 1.621,00 * 2% = R$ 32,42.',
    contextInput: { salario_base: 1621.00, dias_trabalhados: 30, is_apprentice: true, num_dependentes: 0 },
    expected: {
      total_proventos: 1621.00,
      total_descontos: 121.57,
      liquido: 1499.43,
      inss: 121.57,
      irrf: 0.00,
      fgts: 32.42
    }
  },
  {
    id: 'GF-32',
    title: 'Admissão Proporcional no Meio do Mês (Dia 11 - 20 Dias Trabalhados na Base 30)',
    category: 'Proporcionalidade',
    legalBasis: 'CLT art. 64 e Convenção Comercial de Departamento Pessoal (base 30)',
    description: 'Salário contratual R$ 3.000,00. Admitido no dia 11 (20 dias trabalhados: 30 - 11 + 1). Salário proporcional apurado = R$ 2.000,00.',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 20, num_dependentes: 0 },
    expected: {
      total_proventos: 2000.00,
      total_descontos: 155.69,
      liquido: 1844.31,
      inss: 155.69,
      irrf: 0.00,
      fgts: 160.00,
      bases: { inss: 2000.00, fgts: 2000.00 }
    }
  },
  {
    id: 'GF-33',
    title: 'Férias de 15 Dias no Mês com Retorno ao Trabalho (INSS Consolidado T16 Doc §4)',
    category: 'Proporcionalidade',
    legalBasis: 'CLT art. 142 e T16 Doc §4',
    description: 'Salário R$ 3.000,00. 15 dias trabalhados no mês (R$ 1.500,00). Base de férias já tributada na competência = R$ 2.000,00. INSS consolidado progressivo.',
    contextInput: {
      salario_base: 3000.00,
      dias_trabalhados: 15,
      base_inss_already_taxed: 2000.00,
      num_dependentes: 0
    },
    expected: {
      total_proventos: 1500.00,
      total_descontos: 152.91,
      liquido: 1347.09,
      inss: 152.91,
      irrf: 0.00,
      fgts: 120.00
    }
  },
  {
    id: 'GF-34',
    title: 'Desconto de Vale-Transporte com Teto de 6% do Salário Base (Lei 7.418/1985)',
    category: 'Benefícios',
    legalBasis: 'Lei 7.418/1985 art. 4º parágrafo único e Decreto 95.247/1987',
    description: 'Salário base R$ 3.000,00. Custo total do benefício R$ 250,00. Desconto efetivo limitado a 6% do salário básico contratual (R$ 180,00).',
    contextInput: { salario_base: 3000.00, dias_trabalhados: 30, num_dependentes: 0 },
    events: [
      { rubric_id: 'rub-201', manual_value: 180.00, origin: 'MANUAL' }
    ],
    expected: {
      total_proventos: 3000.00,
      total_descontos: 428.60,
      liquido: 2571.40,
      inss: 248.60,
      irrf: 0.00,
      fgts: 240.00
    }
  },
  {
    id: 'GF-35',
    title: 'Desconto Simplificado do IRRF (R$ 607,20) Mais Vantajoso que Dedução Legal',
    category: 'Tabela de IRRF',
    legalBasis: 'Lei 14.663/2023 e Lei 15.270/2025',
    description: 'Salário R$ 5.200,00, 0 dependentes. INSS R$ 529,51. O motor adota o Desconto Simplificado de R$ 607,20 por ser superior à dedução do INSS.',
    contextInput: { salario_base: 5200.00, dias_trabalhados: 30, num_dependentes: 0 },
    expected: {
      total_proventos: 5200.00,
      total_descontos: 601.13,
      liquido: 4598.87,
      inss: 529.51,
      irrf: 71.62,
      fgts: 416.00
    }
  }
];
