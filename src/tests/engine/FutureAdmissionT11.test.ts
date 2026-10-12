import { describe, it, expect } from 'vitest';
import {
  shouldSkipFutureAdmission,
  calculateWorkingDays
} from '../../../supabase/functions/payroll-engine/engine/ContractAdmissionFilter';

describe('T11: Ignorar Contratos com Admissão Futura e Tratar Dias Trabalhados (Doc §4)', () => {
  describe('shouldSkipFutureAdmission', () => {
    it('1. Deve ignorar contrato admitido em mês futuro (ex: competência 02/2026, admissão em 01/03/2026)', () => {
      const skip = shouldSkipFutureAdmission('2026-03-01', 2026, 2);
      expect(skip).toBe(true);
    });

    it('2. Deve ignorar contrato admitido em ano futuro (ex: competência 10/2026, admissão em 01/01/2027)', () => {
      const skip = shouldSkipFutureAdmission('2027-01-01', 2026, 10);
      expect(skip).toBe(true);
    });

    it('3. NÃO deve ignorar contrato admitido no próprio mês da competência (ex: 15/02/2026 em 02/2026)', () => {
      const skip = shouldSkipFutureAdmission('2026-02-15', 2026, 2);
      expect(skip).toBe(false);
    });

    it('4. NÃO deve ignorar contrato admitido no último dia do mês (ex: 28/02/2026 em 02/2026)', () => {
      const skip = shouldSkipFutureAdmission('2026-02-28', 2026, 2);
      expect(skip).toBe(false);
    });

    it('5. NÃO deve ignorar contrato admitido em mês anterior (ex: 01/01/2026 em 02/2026)', () => {
      const skip = shouldSkipFutureAdmission('2026-01-01', 2026, 2);
      expect(skip).toBe(false);
    });

    it('6. NÃO deve ignorar contrato sem data de admissão informada', () => {
      const skip = shouldSkipFutureAdmission(null, 2026, 2);
      expect(skip).toBe(false);
    });
  });

  describe('calculateWorkingDays', () => {
    it('1. Contrato antigo admitido antes da competência deve ter 30 dias cheios', () => {
      const dias = calculateWorkingDays('2025-05-10', 2026, 2);
      expect(dias).toBe(30);
    });

    it('2. Contrato admitido no dia 1º do mês deve ter 30 dias cheios', () => {
      const dias = calculateWorkingDays('2026-02-01', 2026, 2);
      expect(dias).toBe(30);
    });

    it('3. Contrato admitido no meio do mês (dia 15) deve ter 16 dias proporcionais (30 - 15 + 1)', () => {
      const dias = calculateWorkingDays('2026-02-15', 2026, 2);
      expect(dias).toBe(16);
    });

    it('4. Contrato admitido no dia 30 deve ter 1 dia proporcional', () => {
      const dias = calculateWorkingDays('2026-04-30', 2026, 4);
      expect(dias).toBe(1);
    });

    it('5. Contrato admitido no dia 31 em mês de 31 dias deve ter 1 dia proporcional (DP padrão)', () => {
      const dias = calculateWorkingDays('2026-01-31', 2026, 1);
      expect(dias).toBe(1);
    });

    it('6. Contrato com admissão em mês futuro deve retornar 0 dias trabalhados', () => {
      const dias = calculateWorkingDays('2026-03-01', 2026, 2);
      expect(dias).toBe(0);
    });

    it('7. Dias trabalhados nunca devem ser negativos', () => {
      const dias = calculateWorkingDays('2026-05-01', 2026, 2);
      expect(dias).toBe(0);
    });
  });
});
