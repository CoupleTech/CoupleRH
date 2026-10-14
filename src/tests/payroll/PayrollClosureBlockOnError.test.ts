import { describe, it, expect } from 'vitest';
import {
  PayrollClosureService,
  PayslipForValidation,
  ClosureValidationResult,
} from '../../services/payroll/payrollClosureService';

describe('PayrollClosureService - Bloqueio de Fechamento com Colaboradores em Erro (Fase P7)', () => {
  const service = new PayrollClosureService();

  const mockValidPayslips: PayslipForValidation[] = [
    {
      id: 'p1',
      contract_id: 'c1',
      employee_name: 'Carlos Silva',
      employee_cpf: '111.222.333-44',
      status: 'CALCULATED',
      total_earnings: 5000,
      total_deductions: 501.51,
      net_salary: 4498.49,
      items: [
        { type: 'EARNING', amount: 5000 },
        { type: 'DEDUCTION', amount: 501.51 },
      ],
    },
    {
      id: 'p2',
      contract_id: 'c2',
      employee_name: 'Mariana Souza',
      employee_cpf: '555.666.777-88',
      status: 'CALCULATED',
      total_earnings: 7350,
      total_deductions: 1714.64,
      net_salary: 5635.36,
      items: [
        { type: 'EARNING', amount: 7350 },
        { type: 'DEDUCTION', amount: 1714.64 },
      ],
    },
  ];

  it('1. Deve autorizar o fechamento quando todos os colaboradores estiverem calculados e sem erros', () => {
    const result: ClosureValidationResult = service.validatePayslipsForClosure(mockValidPayslips);

    expect(result.canClose).toBe(true);
    expect(result.blockingErrorsCount).toBe(0);
    expect(result.errorDetails).toHaveLength(0);
  });

  it('2. Deve bloquear o fechamento se não houver nenhum holerite no período', () => {
    const result = service.validatePayslipsForClosure([]);

    expect(result.canClose).toBe(false);
    expect(result.blockingErrorsCount).toBe(1);
    expect(result.errorDetails[0].category).toBe('EMPTY_PERIOD');
    expect(result.errorDetails[0].reason).toContain('Nenhum holerite');
  });

  it('3. Deve bloquear o fechamento se houver colaborador com status ERROR ou ERRO_CALCULO', () => {
    const payslipsWithErrors: PayslipForValidation[] = [
      ...mockValidPayslips,
      {
        id: 'p3',
        contract_id: 'c3',
        employee_name: 'João Pedro Alcantara',
        employee_cpf: '999.888.777-66',
        status: 'ERROR',
        calculation_error: 'Divisão por zero na rubrica 150 (horas_trabalhadas = 0)',
        total_earnings: 0,
        total_deductions: 0,
        net_salary: 0,
      },
    ];

    const result = service.validatePayslipsForClosure(payslipsWithErrors);

    expect(result.canClose).toBe(false);
    expect(result.blockingErrorsCount).toBe(1);
    expect(result.errorDetails[0].employee_name).toBe('João Pedro Alcantara');
    expect(result.errorDetails[0].category).toBe('CALCULATION_ERROR');
    expect(result.errorDetails[0].reason).toContain('Divisão por zero');
  });

  it('4. Deve bloquear o fechamento se houver colaborador com salário líquido negativo (CLT Art. 462)', () => {
    const payslipsWithNegativeNet: PayslipForValidation[] = [
      ...mockValidPayslips,
      {
        id: 'p4',
        contract_id: 'c4',
        employee_name: 'Fernanda Lima',
        employee_cpf: '333.444.555-66',
        status: 'CALCULATED',
        total_earnings: 2000,
        total_deductions: 2500,
        net_salary: -500,
      },
    ];

    const result = service.validatePayslipsForClosure(payslipsWithNegativeNet);

    expect(result.canClose).toBe(false);
    expect(result.blockingErrorsCount).toBe(1);
    expect(result.errorDetails[0].employee_name).toBe('Fernanda Lima');
    expect(result.errorDetails[0].category).toBe('NEGATIVE_NET');
    expect(result.errorDetails[0].reason).toContain('Salário líquido negativo');
  });

  it('5. Deve bloquear o fechamento se houver divergência matemática entre totais e itens do holerite (T6)', () => {
    const payslipsWithMathError: PayslipForValidation[] = [
      ...mockValidPayslips,
      {
        id: 'p5',
        contract_id: 'c5',
        employee_name: 'Rodrigo Antunes',
        employee_cpf: '444.555.666-77',
        status: 'CALCULATED',
        total_earnings: 4000,
        total_deductions: 400,
        net_salary: 3600,
        items: [
          { type: 'EARNING', amount: 3500 }, // divergência de 500 em relação a total_earnings
          { type: 'DEDUCTION', amount: 400 },
        ],
      },
    ];

    const result = service.validatePayslipsForClosure(payslipsWithMathError);

    expect(result.canClose).toBe(false);
    expect(result.blockingErrorsCount).toBe(1);
    expect(result.errorDetails[0].category).toBe('MATH_INCONSISTENCY');
    expect(result.errorDetails[0].reason).toContain('divergência');
  });

  it('6. Deve acumular múltiplos erros de colaboradores distintos e listar todos no relatório de bloqueio', () => {
    const payslipsMultipleErrors: PayslipForValidation[] = [
      ...mockValidPayslips,
      {
        id: 'p-err-1',
        contract_id: 'c-err-1',
        employee_name: 'Lucas Mendes',
        status: 'CALCULATION_ERROR',
        calculation_error: 'Fórmula inválida na rubrica 301',
        total_earnings: 0,
        total_deductions: 0,
        net_salary: 0,
      },
      {
        id: 'p-err-2',
        contract_id: 'c-err-2',
        employee_name: 'Beatriz Ramos',
        status: 'CALCULATED',
        total_earnings: 1500,
        total_deductions: 1800,
        net_salary: -300,
      },
    ];

    const result = service.validatePayslipsForClosure(payslipsMultipleErrors);

    expect(result.canClose).toBe(false);
    expect(result.blockingErrorsCount).toBe(2);
    const names = result.errorDetails.map(e => e.employee_name);
    expect(names).toContain('Lucas Mendes');
    expect(names).toContain('Beatriz Ramos');
  });

  it('7. Deve lançar exceção em assertCanClosePeriod se validation falhar', () => {
    const invalidPayslips: PayslipForValidation[] = [
      {
        id: 'p1',
        contract_id: 'c1',
        employee_name: 'Colaborador com Erro',
        status: 'ERROR',
        calculation_error: 'Falha fatal',
        total_earnings: 0,
        total_deductions: 0,
        net_salary: 0,
      },
    ];

    expect(() => {
      service.assertCanClosePeriod(invalidPayslips);
    }).toThrowError(/Fechamento de folha bloqueado.*1 colaborador.*em erro/i);
  });
});
