// src/tests/payroll.golden.test.ts
import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../supabase/functions/payroll-engine/engine/PayrollEngine.ts';
import { PayrollContext } from '../../supabase/functions/payroll-engine/engine/PayrollContext.ts';
import {
  testInssBrackets,
  testIrrfBrackets,
  testGeneralLegalParameters
} from './fixtures/legalParameters.ts';
import {
  GOLDEN_PAYSLIP_CASES,
  goldenStandardRubrics
} from './fixtures/goldenPayslipCases.ts';

/**
 * ============================================================================
 * SUÍTE OFICIAL DE GOLDEN FILES — COUPLE RH (FASE P9 - ITEM 2)
 * ============================================================================
 * 35+ holerites canônicos reais com todas as situações trabalhistas da CLT 2026,
 * conferidos pelo contador, cobrindo:
 * - Limites de faixas e teto de INSS
 * - Redutor de IRRF (Lei 15.270/2025) e faixas de transição
 * - Dependentes legais e comparação com desconto simplificado
 * - Horas extras (50% e 100%) e reflexos de DSR em dias reais
 * - Adicional noturno urbano com redução ficta legal (60/52.5) e DSR noturno
 * - Súmula 264 do TST (adicionais integrando a base da hora extra)
 * - Insalubridade (10%, 20%, 40% do SM) e Periculosidade (30% do base)
 * - Não cumulatividade legal de adicionais (CLT art. 193 § 2º)
 * - Faltas injustificadas e perda de repouso remunerado (DSR)
 * - Pensão alimentícia judicial com dedução legal da base do IRRF
 * - Empréstimos consignados com provisão no vale e estorno na folha mensal
 * - Menor Aprendiz com alíquota especial de FGTS (2%)
 * - Proporcionalidade de admissão no decorrer do mês (base 30 de DP)
 * - INSS consolidado por competência (férias + saldo de salário)
 * - Desconto de vale-transporte com teto de 6% do salário base
 * - Invariantes contábeis e idempotência estrita
 */

describe('Fase P9: Golden Files (30+ Holerites Reais CLT 2026 Conferidos pelo Contador)', () => {

  describe('Validação Individual dos 35 Cenários Canônicos (Motor Oficial)', () => {
    GOLDEN_PAYSLIP_CASES.forEach((scenario) => {
      it(`[${scenario.id}] ${scenario.title}`, async () => {
        // 1. Arrange: Montar o contexto real de cálculo
        const rubricasDoCenario = scenario.customRubrics || goldenStandardRubrics;
        
        // Garante que o evento de salário base está presente se não houver evento explícito de salário
        const baseEvents = scenario.events ? [...scenario.events] : [];
        const hasSalaryEvent = baseEvents.some(e => e.rubric_id === 'rub-101');
        if (!hasSalaryEvent) {
          baseEvents.unshift({
            rubric_id: 'rub-101',
            quantity: scenario.contextInput.dias_trabalhados ?? 30,
            origin: 'AUTOMATICA'
          });
        }

        const context = new PayrollContext({
          competencia: '01/2026',
          tipo_folha: scenario.contextInput.tipo_folha || 'MONTHLY',
          salario_base: scenario.contextInput.salario_base,
          dias_trabalhados: scenario.contextInput.dias_trabalhados ?? 30,
          dias_uteis: scenario.contextInput.dias_uteis ?? 26,
          dias_inuteis: scenario.contextInput.dias_inuteis ?? 4,
          divisor: scenario.contextInput.divisor ?? 220,
          salario_minimo: 1621.00,
          num_dependentes: scenario.contextInput.num_dependentes ?? 0,
          is_apprentice: scenario.contextInput.is_apprentice ?? false,
          allow_cumulative_hazard_allowances: scenario.contextInput.allow_cumulative_hazard_allowances ?? false,
          base_inss_already_taxed: scenario.contextInput.base_inss_already_taxed ?? 0,
          rubricas: rubricasDoCenario,
          eventos: baseEvents,
          inss_parameters: testInssBrackets,
          irrf_parameters: testIrrfBrackets,
          general_legal_parameters: testGeneralLegalParameters
        });

        // 2. Act: Executar o motor oficial
        const engine = new PayrollEngine(context);
        const result = await engine.run();

        // 3. Assert: Validação rigorosa dos valores conferidos pelo contador
        expect(result.status).toBe('CALCULADA');

        // Proventos e Descontos
        expect(result.total_proventos).toBeCloseTo(scenario.expected.total_proventos, 2);
        expect(result.total_descontos).toBeCloseTo(scenario.expected.total_descontos, 2);

        // Salário Líquido (Invariante Contábil estrita)
        expect(result.liquido).toBeCloseTo(scenario.expected.liquido, 2);
        expect(result.liquido).toBeCloseTo(result.total_proventos - result.total_descontos, 2);

        // Tributos e Retenções
        expect(result.total_inss).toBeCloseTo(scenario.expected.inss, 2);
        expect(result.total_irrf).toBeCloseTo(scenario.expected.irrf, 2);
        expect(result.total_fgts).toBeCloseTo(scenario.expected.fgts, 2);

        // Bases tributárias (se especificadas no cenário)
        if (scenario.expected.bases?.inss !== undefined) {
          expect(result.bases.inss).toBeCloseTo(scenario.expected.bases.inss, 2);
        }
        if (scenario.expected.bases?.irrf !== undefined) {
          expect(result.bases.irrf).toBeCloseTo(scenario.expected.bases.irrf, 2);
        }
        if (scenario.expected.bases?.fgts !== undefined) {
          expect(result.bases.fgts).toBeCloseTo(scenario.expected.bases.fgts, 2);
        }

        // Memória de cálculo deve estar preenchida e rastreável
        expect(result.memoria_calculo.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Invariantes Contábeis e Garantias Matemáticas Globais', () => {
    it('Deve garantir que o catálogo Golden contém mais de 30 cenários reais (requisito Doc §10)', () => {
      expect(GOLDEN_PAYSLIP_CASES.length).toBeGreaterThanOrEqual(30);
      expect(GOLDEN_PAYSLIP_CASES.length).toBe(35);
    });

    it('Todos os cenários devem fechar a equação contábil: Proventos - Descontos = Líquido', () => {
      GOLDEN_PAYSLIP_CASES.forEach((cs) => {
        const fechamentoEsperado = Number((cs.expected.total_proventos - cs.expected.total_descontos).toFixed(2));
        expect(cs.expected.liquido).toBeCloseTo(fechamentoEsperado, 2);
      });
    });

    it('Idempotência estrita: recálculo consecutivo de qualquer cenário deve gerar resultado idêntico', async () => {
      const scenario = GOLDEN_PAYSLIP_CASES[9]; // GF-10: R$ 5.300,00 com redutor de transição
      
      const makeContext = () => new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: scenario.contextInput.salario_base,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        salario_minimo: 1621.00,
        num_dependentes: 0,
        rubricas: goldenStandardRubrics,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const res1 = await new PayrollEngine(makeContext()).run();
      const res2 = await new PayrollEngine(makeContext()).run();

      expect(res1.total_proventos).toBe(res2.total_proventos);
      expect(res1.total_descontos).toBe(res2.total_descontos);
      expect(res1.liquido).toBe(res2.liquido);
      expect(res1.total_inss).toBe(res2.total_inss);
      expect(res1.total_irrf).toBe(res2.total_irrf);
      expect(res1.total_fgts).toBe(res2.total_fgts);
    });
  });
});
