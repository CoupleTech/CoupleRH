import { describe, it, expect } from 'vitest';
import {
  PayrollComparisonService,
  RawPayslipComparisonData,
} from '../../services/payroll/payrollComparisonService';

describe('Fase P7 - Comparativo Mês a Mês por Colaborador e Centro de Custo (fase.md)', () => {
  const service = new PayrollComparisonService();

  const currentPayslips: RawPayslipComparisonData[] = [
    {
      contract_id: 'c1',
      employee_name: 'Ana Silva',
      cpf: '111.111.111-11',
      cost_center_id: 'cc-ti',
      cost_center_code: '01.01',
      cost_center_name: 'Tecnologia da Informação',
      total_earnings: 10000,
      total_deductions: 2500,
      net_salary: 7500,
      base_fgts: 10000,
      fgts_month: 800,
      estimated_taxes: 2800, // 20% patronal + 8% FGTS
    },
    {
      contract_id: 'c2',
      employee_name: 'Carlos Rocha',
      cpf: '222.222.222-22',
      cost_center_id: 'cc-rh',
      cost_center_code: '02.01',
      cost_center_name: 'Recursos Humanos',
      total_earnings: 5000,
      total_deductions: 1000,
      net_salary: 4000,
      base_fgts: 5000,
      fgts_month: 400,
      estimated_taxes: 1400,
    },
    {
      contract_id: 'c3',
      employee_name: 'Mariana Novaes', // Colaboradora nova no mês
      cpf: '333.333.333-33',
      cost_center_id: 'cc-ti',
      cost_center_code: '01.01',
      cost_center_name: 'Tecnologia da Informação',
      total_earnings: 6000,
      total_deductions: 1200,
      net_salary: 4800,
      base_fgts: 6000,
      fgts_month: 480,
      estimated_taxes: 1680,
    },
  ];

  const previousPayslips: RawPayslipComparisonData[] = [
    {
      contract_id: 'c1',
      employee_name: 'Ana Silva',
      cpf: '111.111.111-11',
      cost_center_id: 'cc-ti',
      cost_center_code: '01.01',
      cost_center_name: 'Tecnologia da Informação',
      total_earnings: 8000, // Subiu de 8000 -> 10000 (+25%)
      total_deductions: 2000,
      net_salary: 6000, // Subiu de 6000 -> 7500 (+25%)
      base_fgts: 8000,
      fgts_month: 640,
      estimated_taxes: 2240,
    },
    {
      contract_id: 'c2',
      employee_name: 'Carlos Rocha',
      cpf: '222.222.222-22',
      cost_center_id: 'cc-rh',
      cost_center_code: '02.01',
      cost_center_name: 'Recursos Humanos',
      total_earnings: 6000, // Caiu de 6000 -> 5000 (-16.7%)
      total_deductions: 1500,
      net_salary: 4500,
      base_fgts: 6000,
      fgts_month: 480,
      estimated_taxes: 1680,
    },
    {
      contract_id: 'c4',
      employee_name: 'Lucas Desligado', // Estava no mês anterior, não está no atual
      cpf: '444.444.444-44',
      cost_center_id: 'cc-rh',
      cost_center_code: '02.01',
      cost_center_name: 'Recursos Humanos',
      total_earnings: 4000,
      total_deductions: 800,
      net_salary: 3200,
      base_fgts: 4000,
      fgts_month: 320,
      estimated_taxes: 1120,
    },
  ];

  describe('1. Comparativo por Colaborador', () => {
    it('deve comparar valores mês a mês e calcular variação absoluta e percentual com precisão', () => {
      const items = service.computeEmployeeComparison(currentPayslips, previousPayslips);

      const ana = items.find(i => i.contract_id === 'c1');
      expect(ana).toBeDefined();
      expect(ana?.employee_name).toBe('Ana Silva');
      expect(ana?.status).toBe('ACTIVE');
      expect(ana?.previous_earnings).toBe(8000);
      expect(ana?.current_earnings).toBe(10000);
      expect(ana?.diff_earnings).toBe(2000);
      expect(ana?.percent_earnings).toBeCloseTo(25.0, 1);
      expect(ana?.previous_net).toBe(6000);
      expect(ana?.current_net).toBe(7500);
      expect(ana?.diff_net).toBe(1500);
      expect(ana?.percent_net).toBeCloseTo(25.0, 1);
    });

    it('deve identificar colaboradores admitidos ou novos no período (status NEW)', () => {
      const items = service.computeEmployeeComparison(currentPayslips, previousPayslips);
      const mariana = items.find(i => i.contract_id === 'c3');

      expect(mariana).toBeDefined();
      expect(mariana?.status).toBe('NEW');
      expect(mariana?.previous_earnings).toBe(0);
      expect(mariana?.current_earnings).toBe(6000);
      expect(mariana?.diff_earnings).toBe(6000);
      expect(mariana?.percent_earnings).toBe(100);
    });

    it('deve identificar colaboradores desligados ou ausentes no período atual (status TERMINATED)', () => {
      const items = service.computeEmployeeComparison(currentPayslips, previousPayslips);
      const lucas = items.find(i => i.contract_id === 'c4');

      expect(lucas).toBeDefined();
      expect(lucas?.status).toBe('TERMINATED');
      expect(lucas?.previous_earnings).toBe(4000);
      expect(lucas?.current_earnings).toBe(0);
      expect(lucas?.diff_earnings).toBe(-4000);
      expect(lucas?.percent_earnings).toBe(-100);
    });
  });

  describe('2. Comparativo por Centro de Custo', () => {
    it('deve agrupar por centro de custo calculando headcount, totais e variações', () => {
      const empItems = service.computeEmployeeComparison(currentPayslips, previousPayslips);
      const totalCurrentCost = empItems.reduce((acc, e) => acc + e.current_total_cost, 0);
      const ccItems = service.computeCostCenterComparison(empItems, totalCurrentCost);

      expect(ccItems).toHaveLength(2); // TI e RH

      const ti = ccItems.find(c => c.cost_center_code === '01.01');
      expect(ti).toBeDefined();
      expect(ti?.cost_center_name).toBe('Tecnologia da Informação');
      expect(ti?.current_headcount).toBe(2); // Ana e Mariana
      expect(ti?.previous_headcount).toBe(1); // Só Ana
      expect(ti?.diff_headcount).toBe(1);
      expect(ti?.previous_earnings).toBe(8000);
      expect(ti?.current_earnings).toBe(16000); // 10000 + 6000
      expect(ti?.diff_earnings).toBe(8000);
      expect(ti?.percent_earnings).toBeCloseTo(100.0, 1);

      const rh = ccItems.find(c => c.cost_center_code === '02.01');
      expect(rh).toBeDefined();
      expect(rh?.cost_center_name).toBe('Recursos Humanos');
      expect(rh?.current_headcount).toBe(1); // Só Carlos
      expect(rh?.previous_headcount).toBe(2); // Carlos e Lucas
      expect(rh?.diff_headcount).toBe(-1);
      expect(rh?.previous_earnings).toBe(10000); // 6000 + 4000
      expect(rh?.current_earnings).toBe(5000);
      expect(rh?.diff_earnings).toBe(-5000);
      expect(rh?.percent_earnings).toBeCloseTo(-50.0, 1);
    });

    it('deve calcular a representatividade percentual de cada centro de custo no custo da empresa', () => {
      const empItems = service.computeEmployeeComparison(currentPayslips, previousPayslips);
      const totalCurrentCost = empItems.reduce((acc, e) => acc + e.current_total_cost, 0);
      const ccItems = service.computeCostCenterComparison(empItems, totalCurrentCost);

      const totalShares = ccItems.reduce((acc, c) => acc + c.percent_of_total_company_cost, 0);
      expect(totalShares).toBeCloseTo(100.0, 1);
    });
  });

  describe('3. Relatório Comparativo Consolidado', () => {
    it('deve gerar relatório com sumário executivo de totais e variações da folha inteira', () => {
      const report = service.generateComparisonReport(
        currentPayslips,
        previousPayslips,
        { id: 'p-curr', month: 10, year: 2026, type: 'MONTHLY' },
        { id: 'p-prev', month: 9, year: 2026, type: 'MONTHLY' }
      );

      expect(report.current_label).toBe('10/2026');
      expect(report.previous_label).toBe('09/2026');
      expect(report.summary.current_headcount).toBe(3);
      expect(report.summary.previous_headcount).toBe(3);
      expect(report.summary.diff_headcount).toBe(0);
      expect(report.summary.current_earnings).toBe(21000); // 10000 + 5000 + 6000
      expect(report.summary.previous_earnings).toBe(18000); // 8000 + 6000 + 4000
      expect(report.summary.diff_earnings).toBe(3000);
      expect(report.summary.percent_earnings).toBeCloseTo(16.67, 1);
      expect(report.by_employee.length).toBe(4); // 3 atuais + 1 desligado
      expect(report.by_cost_center.length).toBe(2);
    });
  });
});
