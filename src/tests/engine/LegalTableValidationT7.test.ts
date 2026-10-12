import { describe, it, expect } from 'vitest';
import {
  formatPeriodStartDate,
  validateLegalVersion,
  validateInssParameters,
  validateIrrfParameters,
  validateGeneralLegalParameters,
  validateAllLegalTables
} from '../../../supabase/functions/payroll-engine/legal/LegalTableValidator';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters } from '../fixtures/legalParameters';

describe('T7: Validação Estrita de Tabelas Legais e Data de Competência (Doc §4)', () => {
  it('1. Deve formatar a data de início da competência sem toISOString() para evitar deslocamento por fuso', () => {
    // Exemplo: outubro de 2026
    const formatted = formatPeriodStartDate(2026, 10);
    expect(formatted).toBe('2026-10-01');

    // Mês de um dígito (fevereiro)
    const feb = formatPeriodStartDate(2026, 2);
    expect(feb).toBe('2026-02-01');
  });

  it('2. Deve lançar erro explícito se nenhuma versão legal vigente for encontrada', () => {
    expect(() => {
      validateLegalVersion(null, 10, 2026);
    }).toThrowError(/Nenhuma versão de parâmetros legais/i);

    expect(() => {
      validateLegalVersion(undefined, 10, 2026);
    }).toThrowError(/Nenhuma versão de parâmetros legais/i);
  });

  it('3. Deve lançar erro se os parâmetros de INSS estiverem ausentes ou vazios', () => {
    expect(() => {
      validateInssParameters([], '2026.1');
    }).toThrowError(/Parâmetros de INSS ausentes/i);

    expect(() => {
      validateInssParameters(null as any, '2026.1');
    }).toThrowError(/Parâmetros de INSS ausentes/i);
  });

  it('4. Deve lançar erro se a última faixa do INSS não tiver teto (base_limit nulo ou indefinido)', () => {
    const invalidInssBrackets = [
      { bracket_number: 1, base_limit: 1621.00, aliquot: 7.5, deduction: 0 },
      { bracket_number: 2, base_limit: 2902.84, aliquot: 9.0, deduction: 0 },
      { bracket_number: 3, base_limit: 4354.27, aliquot: 12.0, deduction: 0 },
      { bracket_number: 4, base_limit: null, aliquot: 14.0, deduction: 0 } // ERRO: INSS precisa ter teto!
    ];

    expect(() => {
      validateInssParameters(invalidInssBrackets, '2026.1');
    }).toThrowError(/última faixa de INSS deve possuir limite/i);
  });

  it('5. Deve lançar erro se os parâmetros de IRRF estiverem ausentes ou vazios', () => {
    expect(() => {
      validateIrrfParameters([], '2026.1');
    }).toThrowError(/Parâmetros de IRRF ausentes/i);
  });

  it('6. Deve lançar erro se a última faixa do IRRF for fechada (base_limit preenchido em vez de aberto/nulo)', () => {
    const invalidIrrfBrackets = [
      { bracket_number: 1, base_limit: 2428.80, aliquot: 0, deduction: 0 },
      { bracket_number: 2, base_limit: 2826.65, aliquot: 7.5, deduction: 182.16 },
      { bracket_number: 3, base_limit: 3751.05, aliquot: 15.0, deduction: 394.16 },
      { bracket_number: 4, base_limit: 4664.68, aliquot: 22.5, deduction: 675.49 },
      { bracket_number: 5, base_limit: 10000.00, aliquot: 27.5, deduction: 908.73 } // ERRO: Última faixa do IRRF deve ser aberta (null)
    ];

    expect(() => {
      validateIrrfParameters(invalidIrrfBrackets, '2026.1');
    }).toThrowError(/última faixa de IRRF deve ser aberta/i);
  });

  it('7. Deve lançar erro se os parâmetros gerais forem ausentes ou não possuírem salário mínimo', () => {
    expect(() => {
      validateGeneralLegalParameters(null, '2026.1');
    }).toThrowError(/Parâmetros legais gerais ausentes/i);

    expect(() => {
      validateGeneralLegalParameters({ minimum_wage: 0 }, '2026.1');
    }).toThrowError(/salário mínimo/i);
  });

  it('8. Deve validar com sucesso quando todos os parâmetros legais estiverem corretos', () => {
    const activeVersion = { id: 'ver-2026-1', version_name: '2026.1' };
    expect(() => {
      validateAllLegalTables({
        version: activeVersion,
        inssBrackets: testInssBrackets,
        irrfBrackets: testIrrfBrackets,
        generalParams: testGeneralLegalParameters,
        periodMonth: 10,
        periodYear: 2026
      });
    }).not.toThrow();
  });
});
