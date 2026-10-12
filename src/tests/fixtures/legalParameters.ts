export const testInssBrackets = [
  { bracket_number: 1, base_limit: 1621.00, aliquot: 7.5, deduction: 0 },
  { bracket_number: 2, base_limit: 2902.84, aliquot: 9.0, deduction: 0 },
  { bracket_number: 3, base_limit: 4354.27, aliquot: 12.0, deduction: 0 },
  { bracket_number: 4, base_limit: 8475.55, aliquot: 14.0, deduction: 0 }
];

export const testIrrfBrackets = [
  { bracket_number: 1, base_limit: 2428.80, aliquot: 0, deduction: 0 },
  { bracket_number: 2, base_limit: 2826.65, aliquot: 7.5, deduction: 182.16 },
  { bracket_number: 3, base_limit: 3751.05, aliquot: 15.0, deduction: 394.16 },
  { bracket_number: 4, base_limit: 4664.68, aliquot: 22.5, deduction: 675.49 },
  { bracket_number: 5, base_limit: null, aliquot: 27.5, deduction: 908.73 }
];

export const testGeneralLegalParameters = {
  minimum_wage: 1621.00,
  dependent_deduction: 189.59,
  simplified_discount: 607.20,
  family_salary_quota: 0,
  family_salary_limit: 0,
  fgts_standard_aliquot: 8.0,
  fgts_apprentice_aliquot: 2.0,
  irrf_exemption_limit: 5000.00,
  irrf_reduction_formula_limit: 7350.00,
  irrf_base_reduction: 312.89,
  irrf_reduction_a: 978.62,
  irrf_reduction_b: 0.133145
};

export const standardSystemRubrics = [
  {
    id: 'rubric-inss-901',
    code: '901',
    name: 'Contribuição INSS',
    type: 'DEDUCTION' as const,
    category: 'TAX',
    calculation_form: 'AUTOMATICA',
    calculation_order: 90,
    incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
  },
  {
    id: 'rubric-irrf-902',
    code: '902',
    name: 'IRRF Mensal',
    type: 'DEDUCTION' as const,
    category: 'TAX',
    calculation_form: 'AUTOMATICA',
    calculation_order: 95,
    incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
  },
  {
    id: 'rubric-fgts-903',
    code: '903',
    name: 'FGTS Mensal (Depósito)',
    type: 'BASE' as const,
    category: 'TAX',
    calculation_form: 'AUTOMATICA',
    calculation_order: 50,
    incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
  }
];

export const defaultTestContextData = {
  competencia: '01/2026',
  tipo_folha: 'MONTHLY',
  salario_minimo: 1621.00,
  inss_parameters: testInssBrackets,
  irrf_parameters: testIrrfBrackets,
  general_legal_parameters: testGeneralLegalParameters
};
