import { describe, it, expect } from 'vitest';
import {
  PayrollClosureService,
  ClosureParams,
  ReopenParams,
} from '../../services/payroll/payrollClosureService';

describe('Fase P7 - Fechamento Imutável, Reabertura e Versionamento de Holerite (Doc §8.4, §9)', () => {
  const service = new PayrollClosureService();

  describe('1. Validação de Perfil Autorizado para Reabertura', () => {
    it('deve autorizar administradores e gestores de DP (system_admin, tenant_admin, dp_manager)', () => {
      expect(service.isRoleAuthorizedToReopen('system_admin')).toBe(true);
      expect(service.isRoleAuthorizedToReopen('tenant_admin')).toBe(true);
      expect(service.isRoleAuthorizedToReopen('dp_manager')).toBe(true);
    });

    it('deve rejeitar operadores, analistas comuns e colaboradores (dp_analyst, employee, viewer)', () => {
      expect(service.isRoleAuthorizedToReopen('dp_analyst')).toBe(false);
      expect(service.isRoleAuthorizedToReopen('employee')).toBe(false);
      expect(service.isRoleAuthorizedToReopen('viewer')).toBe(false);
      expect(service.isRoleAuthorizedToReopen(undefined)).toBe(false);
    });
  });

  describe('2. Validação da Justificativa de Reabertura', () => {
    it('deve aceitar justificativas formais detalhadas (>= 15 caracteres)', () => {
      const validReason = 'Correção de horas extras apuradas após contestação deferida de ponto.';
      const validation = service.validateReopenReason(validReason);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('deve rejeitar justificativas vazias ou com menos de 15 caracteres', () => {
      expect(service.validateReopenReason('').isValid).toBe(false);
      expect(service.validateReopenReason('ajuste').isValid).toBe(false);
      expect(service.validateReopenReason('falha menor').isValid).toBe(false); // 11 caracteres
      expect(service.validateReopenReason('   curto   ').isValid).toBe(false);
    });
  });

  describe('3. Imutabilidade e Estados da Folha', () => {
    it('deve identificar que folha fechada (CLOSED) é estritamente imutável', () => {
      expect(service.isPeriodImmutable('CLOSED')).toBe(true);
    });

    it('deve permitir mutação controlada apenas em status de rascunho, cálculo e reabertura', () => {
      expect(service.isPeriodImmutable('DRAFT')).toBe(false);
      expect(service.isPeriodImmutable('CALCULATING')).toBe(false);
      expect(service.isPeriodImmutable('CALCULATED')).toBe(false);
      expect(service.isPeriodImmutable('CONFERENCE')).toBe(false);
      expect(service.isPeriodImmutable('REOPENED')).toBe(false);
    });
  });

  describe('4. Versionamento de Holerites e Ciclo de Vida', () => {
    it('deve incrementar a versão do período e holerites na reabertura (v1 -> v2)', () => {
      const currentVersion = 1;
      const nextVersion = service.calculateNextVersion(currentVersion);
      expect(nextVersion).toBe(2);
    });

    it('deve marcar versão anterior como superseded e gerar payload de nova versão', () => {
      const payslips = [
        { id: 'p1', contract_id: 'c1', version: 1, net_salary: 3000 },
        { id: 'p2', contract_id: 'c2', version: 1, net_salary: 4500 },
      ];

      const versioned = service.prepareReopenedPayslips(payslips, 2);
      expect(versioned).toHaveLength(2);
      expect(versioned[0].version).toBe(2);
      expect(versioned[0].status).toBe('DRAFT');
      expect(versioned[0].superseded_at).toBeDefined();
    });
  });

  describe('5. Hash de Fechamento e Integridade Forense', () => {
    it('deve gerar hash determinístico de fechamento para garantir que os valores não foram adulterados', () => {
      const payslip = {
        contract_id: 'c1',
        period_id: 'period-123',
        total_earnings: 5000,
        total_deductions: 1000,
        net_salary: 4000,
        version: 1,
      };

      const hash1 = service.computeClosureHash(payslip);
      const hash2 = service.computeClosureHash(payslip);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256

      // Qualquer modificação deve alterar o hash
      const modified = { ...payslip, net_salary: 4000.01 };
      const hashMod = service.computeClosureHash(modified);
      expect(hashMod).not.toBe(hash1);
    });
  });
});
