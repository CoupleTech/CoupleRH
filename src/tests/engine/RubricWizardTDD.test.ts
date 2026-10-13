import { describe, it, expect } from 'vitest';
import {
  RUBRIC_TEMPLATES,
  ESOCIAL_NATURE_SUGGESTIONS,
  getEsocialNatureSuggestion,
  simulateRubricCalculation,
  validateRubricConfig,
  createNewRubricVersion,
  extractFormulaVariables,
  PUBLISHED_VARIABLES,
  RubricConfig,
  SimulationEmployeeContext,
} from '../../services/rubricWizardService';

describe('§6.3 Assistente e Motor de Nova Rubrica (RubricWizard)', () => {
  describe('1. Modelos Predefinidos (Templates)', () => {
    it('deve disponibilizar catálogo de modelos com configurações padrão corretas', () => {
      expect(RUBRIC_TEMPLATES.length).toBeGreaterThanOrEqual(8);

      const templateAdicional = RUBRIC_TEMPLATES.find((t) => t.id === 'ADICIONAL_PERCENTUAL');
      expect(templateAdicional).toBeDefined();
      expect(templateAdicional?.type).toBe('EARNING');
      expect(templateAdicional?.rubric_kind).toBe('OTHER');
      expect(templateAdicional?.calculation_form).toBe('PERCENTUAL');
      expect(templateAdicional?.defaultIncidences.inss).toBe(true);
      expect(templateAdicional?.defaultIncidences.irrf).toBe(true);
      expect(templateAdicional?.defaultIncidences.fgts).toBe(true);

      const templateHE = RUBRIC_TEMPLATES.find((t) => t.id === 'HORAS_FATOR');
      expect(templateHE).toBeDefined();
      expect(templateHE?.rubric_kind).toBe('OVERTIME');
      expect(templateHE?.calculation_form).toBe('FORMULA');
      expect(templateHE?.formula).toContain('DIVISOR');
      expect(templateHE?.formula).toContain('FACTOR');
      expect(templateHE?.formula).toContain('QUANTITY');

      const templatePLR = RUBRIC_TEMPLATES.find((t) => t.id === 'PLR');
      expect(templatePLR).toBeDefined();
      expect(templatePLR?.defaultIncidences.inss).toBe(false);
      expect(templatePLR?.defaultIncidences.fgts).toBe(false);
      expect(templatePLR?.defaultIncidences.irrf_mode).toBe('TABELA_PLR');
      expect(templatePLR?.esocial_nature).toBe('2501');

      const templateDesc = RUBRIC_TEMPLATES.find((t) => t.id === 'DESCONTO_FIXO');
      expect(templateDesc).toBeDefined();
      expect(templateDesc?.type).toBe('DEDUCTION');
      expect(templateDesc?.defaultIncidences.inss).toBe(false);
    });
  });

  describe('2. Assistente por Natureza eSocial (Tabela 03)', () => {
    it('deve sugerir incidências, justificativa técnica e base legal para Horas Extras (1003)', () => {
      const suggestion = getEsocialNatureSuggestion('1003');
      expect(suggestion).toBeDefined();
      expect(suggestion?.name).toContain('Horas extraordinárias');
      expect(suggestion?.inss).toBe(true);
      expect(suggestion?.irrf).toBe(true);
      expect(suggestion?.fgts).toBe(true);
      expect(suggestion?.integra_dsr).toBe(true);
      expect(suggestion?.legal_basis).toContain('CLT');
      expect(suggestion?.justification).toBeTruthy();
    });

    it('deve sugerir isenção de INSS e FGTS com tributação exclusiva para PLR (2501)', () => {
      const suggestion = getEsocialNatureSuggestion('2501');
      expect(suggestion).toBeDefined();
      expect(suggestion?.inss).toBe(false);
      expect(suggestion?.fgts).toBe(false);
      expect(suggestion?.irrf).toBe(true);
      expect(suggestion?.irrf_mode).toBe('TABELA_PLR');
      expect(suggestion?.legal_basis).toContain('Lei 10.101/2000');
    });

    it('deve sugerir isenção total para verbas indenizatórias / ajuda de custo (2000)', () => {
      const suggestion = getEsocialNatureSuggestion('2000');
      expect(suggestion).toBeDefined();
      expect(suggestion?.inss).toBe(false);
      expect(suggestion?.irrf).toBe(false);
      expect(suggestion?.fgts).toBe(false);
      expect(suggestion?.legal_basis).toContain('CLT art. 457 §2º');
    });
  });

  describe('3. Simulador Integrado com Colaborador de Teste', () => {
    const employee: SimulationEmployeeContext = {
      salary: 3000.0,
      minimum_wage: 1621.0,
      divisor: 220,
      quantity: 10,
      factor: 1.5,
      dias_uteis: 24,
      dias_inuteis: 4,
      custom_variables: {
        BASE_DSR: 500.0,
        R101: 3000.0,
      },
    };

    it('deve simular rubrica de Valor Fixo (Provento) e exibir impacto no líquido', () => {
      const config: RubricConfig = {
        code: '150',
        name: 'Gratificação Fixa',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
        quantity: 450.0,
        incidences: { inss: true, irrf: true, fgts: true, integra_dsr: false },
      };

      const result = simulateRubricCalculation(config, employee);
      expect(result.success).toBe(true);
      expect(result.calculatedAmount).toBe(450.0);
      expect(result.netImpact).toBe(450.0);
      expect(result.taxImpact.inss).toBe(450.0);
      expect(result.taxImpact.fgts).toBe(450.0);
      expect(result.calculationMemory).toContain('R$ 450,00');
    });

    it('deve simular rubrica de Adicional Percentual sobre salário', () => {
      const config: RubricConfig = {
        code: '120',
        name: 'Adicional de Função 20%',
        type: 'EARNING',
        rubric_kind: 'ADDITIONAL',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'SALARY',
        percentage: 20,
        incidences: { inss: true, irrf: true, fgts: true, integra_dsr: false },
      };

      const result = simulateRubricCalculation(config, employee);
      expect(result.success).toBe(true);
      // 3000 * 20% = 600.00
      expect(result.calculatedAmount).toBe(600.0);
      expect(result.netImpact).toBe(600.0);
      expect(result.taxImpact.irrf).toBe(600.0);
      expect(result.calculationMemory).toContain('20%');
    });

    it('deve simular rubrica por Fórmula (Horas Extras 50%) com precisão HALF_UP', () => {
      const config: RubricConfig = {
        code: '201',
        name: 'Horas Extras 50%',
        type: 'EARNING',
        rubric_kind: 'OVERTIME',
        calculation_form: 'FORMULA',
        formula: '(SALARY / DIVISOR) * FACTOR * QUANTITY',
        divisor: 220,
        factor: 1.5,
        quantity: 10,
        incidences: { inss: true, irrf: true, fgts: true, integra_dsr: true },
      };

      const result = simulateRubricCalculation(config, employee);
      expect(result.success).toBe(true);
      // (3000 / 220) * 1.5 * 10 = 13.636363... * 15 = 204.55
      expect(result.calculatedAmount).toBe(204.55);
      expect(result.netImpact).toBe(204.55);
      expect(result.taxImpact.dsr).toBe(204.55);
      expect(result.calculationMemory).toContain('204,55');
    });

    it('deve simular Desconto Fixo diminuindo o salário líquido', () => {
      const config: RubricConfig = {
        code: '701',
        name: 'Convênio Farmácia',
        type: 'DEDUCTION',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
        quantity: 120.0,
        incidences: { inss: false, irrf: false, fgts: false, integra_dsr: false },
      };

      const result = simulateRubricCalculation(config, employee);
      expect(result.success).toBe(true);
      expect(result.calculatedAmount).toBe(120.0);
      expect(result.netImpact).toBe(-120.0);
      expect(result.taxImpact.inss).toBe(0);
    });

    it('deve retornar erro claro se houver divisão por zero na fórmula durante a simulação', () => {
      const config: RubricConfig = {
        code: '999',
        name: 'Fórmula com Erro',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FORMULA',
        formula: 'SALARY / 0',
        incidences: { inss: false, irrf: false, fgts: false, integra_dsr: false },
      };

      const result = simulateRubricCalculation(config, employee);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Divisão por zero');
    });
  });

  describe('4. Validações Estritas de Integridade', () => {
    const existingRubrics = [
      { code: '101', name: 'Salário Base', formula: '' },
      { code: '201', name: 'HE 50%', formula: '(SALARY / DIVISOR) * 1.5 * QUANTITY' },
      { code: '301', name: 'DSR sobre HE', formula: 'BASE_DSR * (DIAS_INUTEIS / DIAS_UTEIS)' },
    ];

    it('deve rejeitar código em branco ou já existente', () => {
      const invalidBlank: RubricConfig = {
        code: '',
        name: 'Teste',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
      };
      const validationBlank = validateRubricConfig(invalidBlank, existingRubrics);
      expect(validationBlank.isValid).toBe(false);
      expect(validationBlank.errors).toContain('Código da rubrica é obrigatório.');

      const invalidDuplicate: RubricConfig = {
        code: '101',
        name: 'Teste Duplicado',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
      };
      const validationDup = validateRubricConfig(invalidDuplicate, existingRubrics);
      expect(validationDup.isValid).toBe(false);
      expect(validationDup.errors.some((e) => e.includes('já está em uso'))).toBe(true);
    });

    it('deve rejeitar rubrica sem rubric_kind definido', () => {
      const invalidKind = {
        code: '450',
        name: 'Sem kind',
        type: 'EARNING',
        rubric_kind: '' as any,
        calculation_form: 'FIXO',
      } as RubricConfig;
      const validation = validateRubricConfig(invalidKind, existingRubrics);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Tipo do motor (rubric_kind) é obrigatório.');
    });

    it('deve rejeitar fórmula com variáveis não publicadas ou sintaxe inválida', () => {
      const invalidVar: RubricConfig = {
        code: '450',
        name: 'Variável Fantasma',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FORMULA',
        formula: 'SALARY + VARIAVEL_INEXISTENTE * 2',
      };
      const val1 = validateRubricConfig(invalidVar, existingRubrics);
      expect(val1.isValid).toBe(false);
      expect(val1.errors.some((e) => e.includes('VARIAVEL_INEXISTENTE'))).toBe(true);

      const invalidSyntax: RubricConfig = {
        code: '451',
        name: 'Sintaxe Quebrada',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FORMULA',
        formula: 'SALARY + * 2',
      };
      const val2 = validateRubricConfig(invalidSyntax, existingRubrics);
      expect(val2.isValid).toBe(false);
      expect(val2.errors.some((e) => e.includes('Sintaxe da fórmula inválida'))).toBe(true);
    });

    it('deve detectar e bloquear ciclo de dependência entre fórmulas', () => {
      // 401 depende de 402, e 402 depende de 401
      const rubricsWithCycle = [
        { code: '402', name: 'Rubrica B', formula: 'R401 + 10' },
      ];
      const cycleConfig: RubricConfig = {
        code: '401',
        name: 'Rubrica A',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FORMULA',
        formula: 'R402 * 2',
      };

      const val = validateRubricConfig(cycleConfig, rubricsWithCycle);
      expect(val.isValid).toBe(false);
      expect(val.errors.some((e) => e.includes('Ciclo de dependência detectado'))).toBe(true);
    });

    it('deve emitir warning/erro se incidências forem incoerentes com a natureza eSocial', () => {
      const incoerentePLR: RubricConfig = {
        code: '550',
        name: 'PLR com INSS indevido',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
        esocial_nature: '2501',
        incidences: { inss: true, irrf: true, fgts: false, integra_dsr: false },
      };

      const val = validateRubricConfig(incoerentePLR, existingRubrics);
      expect(val.isValid).toBe(false);
      expect(val.errors.some((e) => e.includes('Lei 10.101/2000 proíbe incidência de INSS sobre PLR'))).toBe(true);
    });
  });

  describe('5. Ciclo de Vida, Aprovação e Imutabilidade', () => {
    it('deve permitir criar nova versão de uma rubrica ativa sem mutação destrutiva', () => {
      const activeRubric = {
        id: 'rub-uuid-1',
        code: '120',
        name: 'Adicional de Função 20%',
        type: 'EARNING',
        rubric_kind: 'ADDITIONAL' as const,
        calculation_form: 'PERCENTUAL',
        percentage: 20,
        version: 1,
        status: 'ACTIVE' as const,
        valid_from: '2026-01-01',
        valid_to: null,
      };

      const newVersion = createNewRubricVersion(activeRubric, {
        percentage: 25,
        valid_from: '2026-07-01',
        legal_basis: 'ACT Cláusula 12/2026',
      }, 'admin-uuid-123');

      expect(newVersion.version).toBe(2);
      expect(newVersion.percentage).toBe(25);
      expect(newVersion.valid_from).toBe('2026-07-01');
      expect(newVersion.status).toBe('APPROVED');
      expect(newVersion.approved_by).toBe('admin-uuid-123');
      expect(newVersion.previous_version_id).toBe('rub-uuid-1');
    });

    it('deve listar todas as variáveis publicadas suportadas pelo motor', () => {
      expect(PUBLISHED_VARIABLES).toContain('SALARY');
      expect(PUBLISHED_VARIABLES).toContain('MINIMUM_WAGE');
      expect(PUBLISHED_VARIABLES).toContain('DIVISOR');
      expect(PUBLISHED_VARIABLES).toContain('FACTOR');
      expect(PUBLISHED_VARIABLES).toContain('QUANTITY');
      expect(PUBLISHED_VARIABLES).toContain('BASE_DSR');
      expect(PUBLISHED_VARIABLES).toContain('BASE_HORA_EXTRA');
    });

    it('deve extrair variáveis de uma fórmula corretamente', () => {
      const formula = '(SALARY / DIVISOR) * FACTOR * QUANTITY + R101';
      const extracted = extractFormulaVariables(formula);
      expect(extracted).toContain('SALARY');
      expect(extracted).toContain('DIVISOR');
      expect(extracted).toContain('FACTOR');
      expect(extracted).toContain('QUANTITY');
      expect(extracted).toContain('R101');
    });
  });
});
