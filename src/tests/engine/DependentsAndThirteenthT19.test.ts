import { describe, it, expect } from 'vitest';
import { evaluateIRRFDependents, type DependentInput } from '../../../supabase/functions/payroll-engine/engine/DependentsEligibility.ts';
import {
  calculateThirteenthAvos,
  calculateThirteenthValues,
} from '../../../supabase/functions/payroll-engine/engine/ThirteenthSalaryCalculator.ts';
import { FGTSCalculator } from '../../../supabase/functions/payroll-engine/legal/FGTSCalculator.ts';
import { EmployerTaxesCalculator } from '../../../supabase/functions/payroll-engine/legal/EmployerTaxesCalculator.ts';
import { buildAtomicPayrollPayload } from '../../../supabase/functions/payroll-engine/engine/AtomicPersistence.ts';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine.ts';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext.ts';

describe('T19: Dependentes por Idade/Vigência, 13º Salário, FGTS Aprendiz, Patronais por Regime e Versões Reais', () => {

  describe('1. Dependentes por Idade, Parentesco e Prevenção de Duplicidade (Art. 35 Lei 9.250/95)', () => {
    it('deve aceitar filho até 21 anos e rejeitar filho com 22 anos ou mais sem comprovação universitária', () => {
      const deps: DependentInput[] = [
        {
          id: 'dep-1',
          full_name: 'Filho Menor',
          birth_date: '2008-05-10', // 18 anos em 2026
          relationship: 'CHILD',
          is_irrf_dependent: true,
        },
        {
          id: 'dep-2',
          full_name: 'Filho Maior Não Estudante',
          birth_date: '2004-01-15', // 22 anos em 2026
          relationship: 'CHILD',
          is_irrf_dependent: true,
          is_student: false,
        },
        {
          id: 'dep-3',
          full_name: 'Filho Maior Universitário',
          birth_date: '2003-08-20', // 23 anos em 2026 (<= 24 anos)
          relationship: 'CHILD',
          is_irrf_dependent: true,
          is_student: true,
        },
      ];

      const result = evaluateIRRFDependents(deps, 2026, 10);

      expect(result.eligibleCount).toBe(2);
      expect(result.eligibleDependents.map(d => d.id)).toEqual(['dep-1', 'dep-3']);
      expect(result.rejectedDependents.length).toBe(1);
      expect(result.rejectedDependents[0].dependent.id).toBe('dep-2');
      expect(result.rejectedDependents[0].reason).toContain('excede o limite legal');
    });

    it('deve aceitar cônjuge e pais sem limite de idade', () => {
      const deps: DependentInput[] = [
        {
          id: 'dep-conjuge',
          full_name: 'Esposa',
          birth_date: '1980-02-14', // 46 anos
          relationship: 'SPOUSE',
          is_irrf_dependent: true,
        },
        {
          id: 'dep-mae',
          full_name: 'Mãe',
          birth_date: '1955-11-03', // 70 anos
          relationship: 'PARENT',
          is_irrf_dependent: true,
        },
      ];

      const result = evaluateIRRFDependents(deps, 2026, 10);
      expect(result.eligibleCount).toBe(2);
      expect(result.rejectedDependents.length).toBe(0);
    });

    it('não deve contar dependente em duplicidade por CPF ou ID', () => {
      const deps: DependentInput[] = [
        {
          id: 'dep-a',
          full_name: 'Filho 1',
          cpf: '123.456.789-00',
          birth_date: '2015-06-01',
          relationship: 'CHILD',
          is_irrf_dependent: true,
        },
        {
          id: 'dep-b',
          full_name: 'Filho 1 Duplicado',
          cpf: '12345678900', // Mesmo CPF sem pontuação
          birth_date: '2015-06-01',
          relationship: 'CHILD',
          is_irrf_dependent: true,
        },
      ];

      const result = evaluateIRRFDependents(deps, 2026, 10);
      expect(result.eligibleCount).toBe(1);
      expect(result.rejectedDependents.length).toBe(1);
      expect(result.rejectedDependents[0].reason).toContain('duplicidade cadastral');
    });

    it('deve rejeitar dependente com is_irrf_dependent = false', () => {
      const deps: DependentInput[] = [
        {
          id: 'dep-sem-ir',
          full_name: 'Dependente só Salário Família',
          birth_date: '2018-01-01',
          relationship: 'CHILD',
          is_irrf_dependent: false,
        },
      ];

      const result = evaluateIRRFDependents(deps, 2026, 10);
      expect(result.eligibleCount).toBe(0);
      expect(result.rejectedDependents.length).toBe(1);
    });
  });

  describe('2. 13º Salário: Fração de 15 Dias e Faltas Injustificadas (Lei 4.090/62 e Decreto 10.854/2021)', () => {
    it('deve conferir avo de admissão se trabalhou >= 15 dias no mês, e negar se < 15 dias', () => {
      // Admitido em 16/04/2026 (abril tem 30 dias: 30 - 16 + 1 = 15 dias trabalhados -> ganha avo de abril)
      // Meses de abril a dezembro = 9 avos
      const avos15Dias = calculateThirteenthAvos('2026-04-16', 2026, 12);
      expect(avos15Dias.totalAvos).toBe(9);

      // Admitido em 17/04/2026 (30 - 17 + 1 = 14 dias trabalhados -> perde avo de abril)
      // Meses de maio a dezembro = 8 avos
      const avos14Dias = calculateThirteenthAvos('2026-04-17', 2026, 12);
      expect(avos14Dias.totalAvos).toBe(8);

      // Admitido em 17/05/2026 (maio tem 31 dias: 31 - 17 + 1 = 15 dias trabalhados -> ganha avo de maio)
      // Meses de maio a dezembro = 8 avos
      const avosMaio = calculateThirteenthAvos('2026-05-17', 2026, 12);
      expect(avosMaio.totalAvos).toBe(8);
    });

    it('deve retirar 1 avo de 13º para cada mês com mais de 15 faltas injustificadas (Art. 76 Decreto 10.854/2021)', () => {
      // Colaborador admitido no início do ano (2026-01-01)
      // Em agosto (mês 8) teve 16 faltas injustificadas (> 15 faltas -> perde o avo de agosto)
      // Em setembro (mês 9) teve 10 faltas injustificadas (<= 15 faltas -> mantém o avo)
      const absences = { 8: 16, 9: 10 };
      const result = calculateThirteenthAvos('2026-01-01', 2026, 12, absences);

      expect(result.totalAvos).toBe(11); // 12 - 1 = 11 avos
      const augustDetail = result.monthDetails.find(m => m.month === 8);
      expect(augustDetail?.hasAvo).toBe(false);
      expect(augustDetail?.reason).toContain('mais de 15 faltas injustificadas');

      const septDetail = result.monthDetails.find(m => m.month === 9);
      expect(septDetail?.hasAvo).toBe(true);
    });

    it('deve calcular remuneração do 13º com médias de variáveis (Súmulas 45 e 60 TST) e adiantamento', () => {
      const baseSalary = 3000.00;
      const mediaVariaveis = 600.00; // Horas extras e adicional noturno habituais
      const avos = 12;

      // 1ª Parcela (50% do total apurado)
      const p1 = calculateThirteenthValues(baseSalary, mediaVariaveis, avos, 'THIRTEENTH_1');
      expect(p1.baseRemunerationWithAverages).toBe(3600.00);
      expect(p1.totalThirteenthGross).toBe(3600.00);
      expect(p1.firstInstallmentGross).toBe(1800.00);
      expect(p1.netPayable).toBe(1800.00);

      // 2ª Parcela (Desconta adiantamento da 1ª parcela)
      const p2 = calculateThirteenthValues(baseSalary, mediaVariaveis, avos, 'THIRTEENTH_2', 1800.00);
      expect(p2.totalThirteenthGross).toBe(3600.00);
      expect(p2.advanceDeduction).toBe(1800.00);
      expect(p2.netPayable).toBe(1800.00);
    });
  });

  describe('3. FGTS por Categoria Contratual: Menor Aprendiz (2%) vs CLT Padrão (8%)', () => {
    it('deve aplicar alíquota de 8% de FGTS para empregado CLT comum', () => {
      const base = 2500.00;
      const result = FGTSCalculator.calculate(base, false);
      expect(result.rate).toBe(8.0);
      expect(result.value).toBe(200.00); // 2500 * 0.08
    });

    it('deve aplicar alíquota de 2% de FGTS para Menor Aprendiz (Lei 8.036/90 art. 15 e CLT art. 428)', () => {
      const base = 1500.00;
      const result = FGTSCalculator.calculate(base, true);
      expect(result.rate).toBe(2.0);
      expect(result.value).toBe(30.00); // 1500 * 0.02
    });

    it('deve respeitar parâmetros legais quando fornecidos em fração decimal ou percentual', () => {
      const base = 1000.00;
      // Parâmetro em fração decimal (0.02)
      const res1 = FGTSCalculator.calculate(base, true, 0.08, 0.02);
      expect(res1.rate).toBe(2.0);
      expect(res1.value).toBe(20.00);

      // Parâmetro em percentual (8.0 e 2.0)
      const res2 = FGTSCalculator.calculate(base, false, 8.0, 2.0);
      expect(res2.rate).toBe(8.0);
      expect(res2.value).toBe(80.00);
    });

    it('PayrollEngine deve calcular FGTS com alíquota de 2% quando is_apprentice for true no contrato', async () => {
      const context = new PayrollContext({
        competencia: '10/2026',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-aprendiz',
        contrato_id: 'cont-aprendiz',
        salario_base: 1500.00,
        salario_minimo: 1518.00,
        is_apprentice: true,
        rubricas: [
          {
            id: 'rub-101',
            code: '101',
            name: 'Salário Base',
            type: 'EARNING',
            rubric_kind: 'SALARY_BASE',
            calculation_form: 'DIAS',
            calculation_base: 'SALARIO_BASE',
            divisor: 30,
            calculation_order: 10,
            incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true },
          },
          {
            id: 'rub-901',
            code: '901',
            name: 'INSS',
            type: 'DEDUCTION',
            incidencias: {},
          },
          {
            id: 'rub-902',
            code: '902',
            name: 'IRRF',
            type: 'DEDUCTION',
            incidencias: {},
          },
          {
            id: 'rub-903',
            code: '903',
            name: 'FGTS Mensal',
            type: 'BASE',
            incidencias: {},
          },
        ],
        eventos: [
          { rubric_id: 'rub-101', manual_value: 1500.00, quantity: 30 }
        ],
        inss_parameters: [
          { min_value: 0, max_value: 1518.00, rate: 0.075 }
        ],
        irrf_parameters: [
          { min_value: 0, max_value: 2428.80, rate: 0, deduction: 0 }
        ],
        general_legal_parameters: {
          minimum_wage: 1518.00,
          simplified_discount: 607.20,
          dependent_deduction: 189.59,
          fgts_standard_aliquot: 0.08,
          fgts_apprentice_aliquot: 0.02,
        }
      });

      const engine = new PayrollEngine(context);
      const output = await engine.run();

      expect(output.bases.fgts).toBe(1500.00);
      // FGTS Aprendiz: 1500 * 0.02 = 30.00
      expect(output.total_fgts).toBe(30.00);

      const memFgts = output.memoria_calculo.find(m => m.step_name === 'FGTS');
      expect(memFgts?.percentage_used).toBe(2.0);
      expect(memFgts?.parsed_formula).toContain('[MENOR APRENDIZ]');
    });
  });

  describe('4. Encargos Patronais por Regime (Simples Nacional vs CPRB vs Geral)', () => {
    it('deve isentar cota patronal previdenciária de 20%, RAT e terceiros para Simples Nacional (Anexos I, II, III e V)', () => {
      const baseInss = 10000.00;
      const baseFgts = 10000.00;

      const taxes = EmployerTaxesCalculator.calculate(baseInss, baseFgts, {
        tax_regime: 'SIMPLES_NACIONAL',
        simples_anexo: 'III',
      });

      expect(taxes.inss_patronal).toBe(0);
      expect(taxes.rat_adjusted).toBe(0);
      expect(taxes.terceiros).toBe(0);
      // FGTS patronal é mantido
      expect(taxes.fgts_patronal).toBe(800.00);
      expect(taxes.total).toBe(800.00);
      expect(taxes.regimeApplied).toContain('SIMPLES_NACIONAL_III');
    });

    it('deve cobrar patronal e RAT, mas isentar terceiros para Simples Nacional Anexo IV', () => {
      const baseInss = 10000.00;
      const baseFgts = 10000.00;

      const taxes = EmployerTaxesCalculator.calculate(baseInss, baseFgts, {
        tax_regime: 'SIMPLES_NACIONAL',
        simples_anexo: 'IV',
        inss_patronal_percentage: 20,
        rat_percentage: 2,
        fap_multiplier: 1.0,
      });

      expect(taxes.inss_patronal).toBe(2000.00); // 20%
      expect(taxes.rat_adjusted).toBe(200.00);   // 2%
      expect(taxes.terceiros).toBe(0);           // Isento de Outras Entidades
      expect(taxes.fgts_patronal).toBe(800.00);
      expect(taxes.total).toBe(3000.00);
      expect(taxes.regimeApplied).toBe('SIMPLES_NACIONAL_ANEXO_IV');
    });

    it('deve isentar cota patronal de 20% mas manter RAT e Terceiros para empresa com CPRB (Desoneração da Folha)', () => {
      const baseInss = 10000.00;
      const baseFgts = 10000.00;

      const taxes = EmployerTaxesCalculator.calculate(baseInss, baseFgts, {
        tax_regime: 'LUCRO_PRESUMIDO',
        is_cprb_exempted: true,
        rat_percentage: 2,
        fap_multiplier: 1.0,
        terceiros_percentage: 5.8,
      });

      expect(taxes.inss_patronal).toBe(0);       // Substituído por CPRB sobre receita
      expect(taxes.rat_adjusted).toBe(200.00);   // RAT mantido
      expect(taxes.terceiros).toBe(580.00);      // Terceiros mantido
      expect(taxes.fgts_patronal).toBe(800.00);
      expect(taxes.total).toBe(1580.00);
      expect(taxes.regimeApplied).toBe('CPRB_DESONERADO');
    });

    it('deve recolher encargos integrais no Regime Geral (Lucro Presumido / Real padrão)', () => {
      const baseInss = 10000.00;
      const baseFgts = 10000.00;

      const taxes = EmployerTaxesCalculator.calculate(baseInss, baseFgts, {
        tax_regime: 'LUCRO_REAL',
        inss_patronal_percentage: 20,
        rat_percentage: 2,
        fap_multiplier: 1.0,
        terceiros_percentage: 5.8,
      });

      expect(taxes.inss_patronal).toBe(2000.00);
      expect(taxes.rat_adjusted).toBe(200.00);
      expect(taxes.terceiros).toBe(580.00);
      expect(taxes.fgts_patronal).toBe(800.00);
      expect(taxes.total).toBe(3580.00);
      expect(taxes.regimeApplied).toBe('REGIME_GERAL');
    });
  });

  describe('5. Gravação de legal_version_id e ENGINE_VERSION real', () => {
    it('buildAtomicPayrollPayload deve persistir legal_version_id e a versão real do motor', () => {
      const payload = buildAtomicPayrollPayload({
        tenant_id: 'ten-1',
        period_id: 'per-1',
        payslips: [
          {
            contract_id: 'cont-1',
            total_earnings: 3000,
            total_deductions: 300,
            net_salary: 2700,
            base_inss: 3000,
            base_irrf: 2700,
            base_fgts: 3000,
            fgts_month: 240,
            legal_version_id: 'lv-uuid-2026-oficial',
            engine_version: '2.1.0',
            inss_table_version: 'TABELA_2026_V1',
            irrf_table_version: 'TABELA_2026_V1',
            items: [],
            memory: [],
          }
        ],
        company_taxes: []
      });

      expect(payload.payslips.length).toBe(1);
      const p = payload.payslips[0];
      expect(p.legal_version_id).toBe('lv-uuid-2026-oficial');
      expect(p.engine_version).toBe('2.1.0');
      expect(p.inss_table_version).toBe('TABELA_2026_V1');
      expect(p.irrf_table_version).toBe('TABELA_2026_V1');
    });
  });

});
