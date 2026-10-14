import { describe, it, expect } from 'vitest';
import {
  PayrollPreFlightAuditService,
  PreFlightAuditParams,
  PreFlightFinding,
} from '../../services/payroll/payrollPreFlightAuditService';

describe('Fase P7 - Pré-folha com Críticas (Doc §9-§11)', () => {
  const service = new PayrollPreFlightAuditService();

  describe('1. Variação do Líquido (NET_VARIATION)', () => {
    it('deve gerar crítica CRITICAL quando o salário líquido for zero ou negativo', () => {
      const currentPayslip = {
        contract_id: 'c1',
        employee_name: 'Ana Silva',
        net_salary: 0,
        total_earnings: 2000,
        total_deductions: 2000,
        base_inss: 2000,
        base_fgts: 2000,
        base_irrf: 1800,
      };

      const findings = service.checkNetSalaryVariation(currentPayslip, null, 'Ana Silva');
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('NET_VARIATION');
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('zerado ou negativo');
    });

    it('deve gerar crítica WARNING quando houver queda brusca de salário líquido (>= 20% e >= R$ 200)', () => {
      const currentPayslip = {
        contract_id: 'c1',
        employee_name: 'Carlos Oliveira',
        net_salary: 2400,
        total_earnings: 3000,
        total_deductions: 600,
        base_inss: 3000,
        base_fgts: 3000,
      };
      const previousPayslip = {
        contract_id: 'c1',
        employee_name: 'Carlos Oliveira',
        net_salary: 4000, // Queda de 4000 -> 2400 = -40% (R$ 1.600)
        total_earnings: 5000,
        total_deductions: 1000,
      };

      const findings = service.checkNetSalaryVariation(currentPayslip, previousPayslip, 'Carlos Oliveira');
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('NET_VARIATION');
      expect(findings[0].severity).toBe('WARNING');
      expect(findings[0].title).toContain('Queda de salário líquido');
      expect(findings[0].description).toContain('-40.0%');
    });

    it('deve gerar crítica INFO ou WARNING quando houver aumento atípico no salário líquido', () => {
      const currentPayslip = {
        contract_id: 'c2',
        employee_name: 'Mariana Lima',
        net_salary: 6000, // Subiu de 3000 -> 6000 (+100%)
        total_earnings: 7500,
        total_deductions: 1500,
        base_inss: 7500,
        base_fgts: 7500,
      };
      const previousPayslip = {
        contract_id: 'c2',
        employee_name: 'Mariana Lima',
        net_salary: 3000,
        total_earnings: 3500,
        total_deductions: 500,
      };

      const findings = service.checkNetSalaryVariation(currentPayslip, previousPayslip, 'Mariana Lima');
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('NET_VARIATION');
      expect(findings[0].severity).toBe('WARNING');
      expect(findings[0].title).toContain('Aumento expressivo');
      expect(findings[0].description).toContain('+100.0%');
    });

    it('não deve gerar crítica quando a oscilação for normal (< 20%)', () => {
      const currentPayslip = {
        contract_id: 'c3',
        employee_name: 'Roberto Santos',
        net_salary: 3100,
        total_earnings: 3800,
        total_deductions: 700,
        base_inss: 3800,
        base_fgts: 3800,
      };
      const previousPayslip = {
        contract_id: 'c3',
        employee_name: 'Roberto Santos',
        net_salary: 3000, // +3.3%
        total_earnings: 3700,
        total_deductions: 700,
      };

      const findings = service.checkNetSalaryVariation(currentPayslip, previousPayslip, 'Roberto Santos');
      expect(findings).toHaveLength(0);
    });
  });

  describe('2. Base Zerada (ZERO_BASE)', () => {
    it('deve gerar crítica CRITICAL se a base de INSS for zero com proventos positivos', () => {
      const currentPayslip = {
        contract_id: 'c1',
        employee_name: 'Lucas Mendes',
        net_salary: 3500,
        total_earnings: 4000,
        total_deductions: 500,
        base_inss: 0, // Inconsistência grave
        base_fgts: 4000,
      };

      const findings = service.checkZeroBases(currentPayslip, 'Lucas Mendes', false);
      expect(findings.some(f => f.category === 'ZERO_BASE' && f.severity === 'CRITICAL' && f.title.includes('INSS'))).toBe(true);
    });

    it('deve gerar crítica CRITICAL se a base de FGTS for zero com proventos positivos em contrato padrão', () => {
      const currentPayslip = {
        contract_id: 'c1',
        employee_name: 'Lucas Mendes',
        net_salary: 3500,
        total_earnings: 4000,
        total_deductions: 500,
        base_inss: 4000,
        base_fgts: 0, // Inconsistência grave
      };

      const findings = service.checkZeroBases(currentPayslip, 'Lucas Mendes', false);
      expect(findings.some(f => f.category === 'ZERO_BASE' && f.severity === 'CRITICAL' && f.title.includes('FGTS'))).toBe(true);
    });

    it('deve gerar crítica WARNING quando proventos forem zero e não houver afastamento registrado', () => {
      const currentPayslip = {
        contract_id: 'c2',
        employee_name: 'Fernanda Rocha',
        net_salary: 0,
        total_earnings: 0,
        total_deductions: 0,
        base_inss: 0,
        base_fgts: 0,
      };

      const findings = service.checkZeroBases(currentPayslip, 'Fernanda Rocha', false);
      expect(findings.some(f => f.category === 'ZERO_BASE' && f.severity === 'WARNING' && f.title.includes('Proventos zerados'))).toBe(true);
    });

    it('não deve gerar crítica de proventos zerados se o colaborador estiver afastado com licença', () => {
      const currentPayslip = {
        contract_id: 'c2',
        employee_name: 'Fernanda Rocha',
        net_salary: 0,
        total_earnings: 0,
        total_deductions: 0,
        base_inss: 0,
        base_fgts: 0,
      };

      const findings = service.checkZeroBases(currentPayslip, 'Fernanda Rocha', true); // Afastado
      expect(findings.filter(f => f.title.includes('Proventos zerados'))).toHaveLength(0);
    });
  });

  describe('3. Dependentes Alterados (DEPENDENTS_CHANGED)', () => {
    it('deve gerar crítica WARNING quando houver redução no número de dependentes', () => {
      const findings = service.checkDependentsChanges('c1', 'João Silva', 1, 2);
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('DEPENDENTS_CHANGED');
      expect(findings[0].severity).toBe('WARNING');
      expect(findings[0].title).toContain('Redução de dependentes');
      expect(findings[0].description).toContain('de 2 para 1');
    });

    it('deve gerar crítica INFO quando houver acréscimo de dependentes', () => {
      const findings = service.checkDependentsChanges('c2', 'Clara Costa', 2, 1);
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('DEPENDENTS_CHANGED');
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title).toContain('Novo dependente adicionado');
      expect(findings[0].description).toContain('de 1 para 2');
    });

    it('não deve gerar crítica quando a quantidade de dependentes não mudar', () => {
      const findings = service.checkDependentsChanges('c3', 'Pedro Souza', 1, 1);
      expect(findings).toHaveLength(0);
    });
  });

  describe('4. Rubricas Novas (NEW_RUBRIC)', () => {
    it('deve alertar sobre rubricas que surgiram no mês atual e não existiam no mês anterior', () => {
      const currentItems = [
        { rubric_code: '101', rubric_name: 'Salário Base', amount: 3000, type: 'EARNING' },
        { rubric_code: '804', rubric_name: 'Pensão Alimentícia', amount: 600, type: 'DEDUCTION' },
        { rubric_code: '150', rubric_name: 'Horas Extras 50%', amount: 350, type: 'EARNING' },
      ];
      const previousItems = [
        { rubric_code: '101', rubric_name: 'Salário Base', amount: 3000, type: 'EARNING' },
      ];

      const findings = service.checkNewRubrics(currentItems, previousItems, 'Marcos Alves', 'c1');
      expect(findings).toHaveLength(2);
      expect(findings.map(f => f.title)).toContain('Nova rubrica no mês: [804 - Pensão Alimentícia]');
      expect(findings.map(f => f.title)).toContain('Nova rubrica no mês: [150 - Horas Extras 50%]');
      expect(findings[0].category).toBe('NEW_RUBRIC');
    });

    it('não deve gerar crítica quando todas as rubricas já existiam no mês anterior', () => {
      const currentItems = [
        { rubric_code: '101', rubric_name: 'Salário Base', amount: 3000, type: 'EARNING' },
      ];
      const previousItems = [
        { rubric_code: '101', rubric_name: 'Salário Base', amount: 3000, type: 'EARNING' },
      ];

      const findings = service.checkNewRubrics(currentItems, previousItems, 'Marcos Alves', 'c1');
      expect(findings).toHaveLength(0);
    });
  });

  describe('5. Ponto Pendente (PENDING_TIME_PUNCH)', () => {
    it('deve gerar crítica CRITICAL se houver batidas ímpares não tratadas (MISSING_PUNCH)', () => {
      const timeData = {
        missing_punches_count: 2,
        pending_adjustments_count: 0,
        contested_timesheets_count: 0,
        timesheet_status: 'APPROVED',
      };

      const findings = service.checkPendingTimeTracking('c1', 'Juliana Ramos', timeData);
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('PENDING_TIME_PUNCH');
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('Batidas de ponto ímpares');
      expect(findings[0].description).toContain('2 marcação(ões) pendente(s)');
    });

    it('deve gerar crítica CRITICAL se o espelho de ponto estiver contestado', () => {
      const timeData = {
        missing_punches_count: 0,
        pending_adjustments_count: 0,
        contested_timesheets_count: 1,
        timesheet_status: 'CONTESTED',
      };

      const findings = service.checkPendingTimeTracking('c2', 'Felipe Santos', timeData);
      expect(findings.some(f => f.severity === 'CRITICAL' && f.title.includes('Espelho de ponto em contestação'))).toBe(true);
    });

    it('deve gerar crítica WARNING se houver pedidos de ajuste de ponto pendentes de aprovação', () => {
      const timeData = {
        missing_punches_count: 0,
        pending_adjustments_count: 3,
        contested_timesheets_count: 0,
        timesheet_status: 'DRAFT',
      };

      const findings = service.checkPendingTimeTracking('c3', 'Bruna Dias', timeData);
      expect(findings.some(f => f.severity === 'WARNING' && f.title.includes('Ajustes de ponto pendentes'))).toBe(true);
    });

    it('não deve gerar crítica quando o ponto estiver 100% regularizado', () => {
      const timeData = {
        missing_punches_count: 0,
        pending_adjustments_count: 0,
        contested_timesheets_count: 0,
        timesheet_status: 'APPROVED',
      };

      const findings = service.checkPendingTimeTracking('c4', 'Thiago Meireles', timeData);
      expect(findings).toHaveLength(0);
    });
  });

  describe('6. Auditoria Completa e Governança da Pré-folha', () => {
    it('deve consolidar críticas, calcular sumário e definir can_proceed_to_closure = false com críticos', () => {
      const auditParams: PreFlightAuditParams = {
        period_id: 'period-1',
        current_payslips: [
          {
            id: 'p1',
            contract_id: 'c1',
            employee_name: 'Colaborador Com Erro',
            net_salary: 0, // CRITICAL
            total_earnings: 2000,
            total_deductions: 2000,
            base_inss: 0, // CRITICAL
            base_fgts: 2000,
            items: [{ rubric_code: '101', rubric_name: 'Salário', amount: 2000, type: 'EARNING' }],
          },
        ],
        previous_payslips: [],
        dependents_data: { c1: { current: 1, previous: 1 } },
        time_tracking_data: { c1: { missing_punches_count: 0, pending_adjustments_count: 0, contested_timesheets_count: 0 } },
      };

      const result = service.auditPrePayroll(auditParams);
      expect(result.summary.total_findings).toBeGreaterThanOrEqual(2);
      expect(result.summary.critical_count).toBeGreaterThanOrEqual(2);
      expect(result.summary.can_proceed_to_closure).toBe(false);
      expect(result.findings.some(f => f.severity === 'CRITICAL')).toBe(true);
    });

    it('deve definir can_proceed_to_closure = true quando houver apenas avisos e informativos', () => {
      const auditParams: PreFlightAuditParams = {
        period_id: 'period-2',
        current_payslips: [
          {
            id: 'p2',
            contract_id: 'c2',
            employee_name: 'Colaborador Sem Erro Grave',
            net_salary: 3100,
            total_earnings: 3800,
            total_deductions: 700,
            base_inss: 3800,
            base_fgts: 3800,
            items: [
              { rubric_code: '101', rubric_name: 'Salário Base', amount: 3500, type: 'EARNING' },
              { rubric_code: '150', rubric_name: 'HE 50%', amount: 300, type: 'EARNING' }, // Nova rubrica -> INFO
            ],
          },
        ],
        previous_payslips: [
          {
            id: 'p0',
            contract_id: 'c2',
            employee_name: 'Colaborador Sem Erro Grave',
            net_salary: 2900,
            total_earnings: 3500,
            total_deductions: 600,
            items: [{ rubric_code: '101', rubric_name: 'Salário Base', amount: 3500, type: 'EARNING' }],
          },
        ],
        dependents_data: { c2: { current: 2, previous: 1 } }, // +1 dependente -> INFO
        time_tracking_data: { c2: { missing_punches_count: 0, pending_adjustments_count: 0, contested_timesheets_count: 0 } },
      };

      const result = service.auditPrePayroll(auditParams);
      expect(result.summary.critical_count).toBe(0);
      expect(result.summary.warning_count).toBe(0);
      expect(result.summary.info_count).toBeGreaterThan(0);
      expect(result.summary.can_proceed_to_closure).toBe(true);
    });
  });
});
