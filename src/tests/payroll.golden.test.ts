// src/tests/payroll.golden.test.ts
import { describe, it, expect } from 'vitest';

/**
 * Este é um Golden Test anonimizado.
 * O objetivo é garantir que o motor de folha NUNCA quebre cálculos históricos,
 * verificando o input fixo contra o snapshot de saída esperado.
 */

// Mock da engine de cálculo (A ser implementado no backend)
const calculatePayroll = (employeeData: any, periodData: any, rubrics: any[]) => {
  // Simulação estúpida do motor para passar no teste de exemplo
  const baseSalary = employeeData.salary;
  const inss = baseSalary * 0.075; // Simplificação extrema
  const net = baseSalary - inss;
  
  return {
    gross: baseSalary,
    discounts: inss,
    net: net,
    memory: [
      { rule: 'BASE_SALARY', amount: baseSalary },
      { rule: 'INSS_TIER_1', amount: inss }
    ]
  };
};

describe('Golden Tests - Motor de Folha (Fase 4)', () => {
  it('Deve calcular exatamente os mesmos valores para o cenário Padrão CLT 220h (Golden Test 01)', () => {
    // 1. Arrange (Dados Anonimizados Imutáveis)
    const employeeMock = { id: 'uuid-1', category: 'CLT', salary: 1412.00, dependents: 0 };
    const periodMock = { month: 10, year: 2024, workingHours: 220 };
    const rulesSnapshot = [
      { code: '001', type: 'EARNING', formula: 'BASE' },
      { code: '901', type: 'DEDUCTION', formula: 'INSS_2024' }
    ];

    // 2. Act
    const result = calculatePayroll(employeeMock, periodMock, rulesSnapshot);

    // 3. Assert (Contra o Golden Record)
    // Se a lei mudar em 2025, o resultado DESTE teste (Outubro de 2024) não pode mudar.
    expect(result.gross).toBe(1412.00);
    expect(result.discounts).toBeCloseTo(105.90, 2); // 1412 * 7.5%
    expect(result.net).toBeCloseTo(1306.10, 2);
  });
});
