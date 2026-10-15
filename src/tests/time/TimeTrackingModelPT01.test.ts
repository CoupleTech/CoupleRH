import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateTimeDevice,
  validateTimeBankPolicy,
  validateTimePunchRecordMutation,
  calculateDailyViolations,
  type TimeDevice,
  type TimeBankPolicy,
  type TimePunchRecord,
  type TimeDailySummary,
} from '../../services/timeTracking/timeTrackingModel';

describe('PT-01: Modelagem e Regras de Ponto Eletrônico (Portaria 671 / CLT)', () => {
  describe('1. Dispositivos de Ponto (time_devices)', () => {
    it('deve validar com sucesso um dispositivo REP_C (relógio físico Control iD)', () => {
      const device: TimeDevice = {
        tenant_id: 'tenant-123',
        company_id: 'company-456',
        name: 'Relógio Recepção - iDClass',
        kind: 'REP_C',
        vendor: 'Control iD',
        model: 'iDClass',
        serial_number: '00004003789999999',
        host: '192.168.1.100',
        port: 80,
        last_nsr: 1250,
        status: 'ACTIVE',
      };

      const result = validateTimeDevice(device);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve validar um dispositivo REP_P_MOBILE (aplicativo mobile oficial)', () => {
      const device: TimeDevice = {
        tenant_id: 'tenant-123',
        name: 'App Mobile PWA - CoupleRH',
        kind: 'REP_P_MOBILE',
        status: 'ACTIVE',
      };

      const result = validateTimeDevice(device);
      expect(result.isValid).toBe(true);
    });

    it('deve rejeitar tipo de dispositivo inválido fora da Portaria 671', () => {
      const device = {
        tenant_id: 'tenant-123',
        name: 'Dispositivo Fantasma',
        kind: 'INVALID_DEVICE_KIND' as any,
        status: 'ACTIVE' as const,
      };

      const result = validateTimeDevice(device);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tipo de dispositivo inválido. Deve ser REP_C, REP_P_MOBILE ou IMPORT.');
    });
  });

  describe('2. Trilha Imutável de Ponto (time_punch_records)', () => {
    it('deve lançar exceção explícita ao tentar realizar UPDATE em registro original de ponto', () => {
      const originalRecord: TimePunchRecord = {
        id: 'punch-001',
        tenant_id: 'tenant-123',
        device_id: 'dev-001',
        nsr: 1045,
        record_type: 3,
        punched_at: '2026-10-14T08:00:00-03:00',
        cpf: '12345678901',
        source: 'REP',
      };

      expect(() => {
        validateTimePunchRecordMutation('UPDATE', originalRecord, {
          punched_at: '2026-10-14T08:15:00-03:00',
        });
      }).toThrowError(/imutável/i);
    });

    it('deve lançar exceção explícita ao tentar realizar DELETE em registro original de ponto', () => {
      const originalRecord: TimePunchRecord = {
        id: 'punch-001',
        tenant_id: 'tenant-123',
        device_id: 'dev-001',
        nsr: 1045,
        record_type: 3,
        punched_at: '2026-10-14T08:00:00-03:00',
        cpf: '12345678901',
        source: 'REP',
      };

      expect(() => {
        validateTimePunchRecordMutation('DELETE', originalRecord);
      }).toThrowError(/imutável/i);
    });
  });

  describe('3. Política de Banco de Horas (time_bank_accounts)', () => {
    it('deve permitir Acordo Individual com vigência de até 6 meses (CLT art. 59 §5º)', () => {
      const policy: TimeBankPolicy = {
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME',
      };

      const result = validateTimeBankPolicy(policy);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve rejeitar Acordo Individual com vigência superior a 6 meses (exige CCT/ACT)', () => {
      const policy: TimeBankPolicy = {
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 12,
        expiration_rule: 'PAY_AS_OVERTIME',
      };

      const result = validateTimeBankPolicy(policy);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Acordo Individual não pode exceder 6 meses/i);
    });

    it('deve permitir CCT/ACT com vigência de até 12 meses (CLT art. 59 §2º)', () => {
      const policy: TimeBankPolicy = {
        policy_type: 'CCT',
        validity_months: 12,
        expiration_rule: 'PAY_AS_OVERTIME',
      };

      const result = validateTimeBankPolicy(policy);
      expect(result.isValid).toBe(true);
    });

    it('deve rejeitar CCT/ACT com vigência superior a 12 meses (limite anual legal)', () => {
      const policy: TimeBankPolicy = {
        policy_type: 'ACT',
        validity_months: 24,
        expiration_rule: 'PAY_AS_OVERTIME',
      };

      const result = validateTimeBankPolicy(policy);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/não pode exceder 12 meses/i);
    });
  });

  describe('4. Resumo Diário e Detecção de Violações CLT (time_daily_summary)', () => {
    it('deve detectar violação de intervalo intrajornada (CLT art. 71)', () => {
      // Jornada de 8 horas (480 min) com apenas 30 min de almoço (exigido 60 min)
      const summary: Partial<TimeDailySummary> = {
        expected_work_minutes: 480,
        worked_minutes: 480,
        break_expected_minutes: 60,
        break_taken_minutes: 30,
      };

      const violations = calculateDailyViolations(summary);
      expect(violations.intrajornada_violation_minutes).toBe(30);
      expect(violations.inconsistencies).toContain('INTRAJORNADA_VIOLATION');
    });

    it('deve detectar violação de descanso interjornada menor que 11 horas (CLT art. 66)', () => {
      // Saiu às 23:00 (1380m) e entrou no dia seguinte às 07:00 (420m) -> 8h de intervalo (480 min) em vez de 11h (660 min)
      const previousOutTimestamp = new Date('2026-10-14T23:00:00-03:00').getTime();
      const currentInTimestamp = new Date('2026-10-15T07:00:00-03:00').getTime();

      const intervalMinutes = Math.round((currentInTimestamp - previousOutTimestamp) / (1000 * 60)); // 480 min
      expect(intervalMinutes).toBe(480);

      const violations = calculateDailyViolations({
        interjornada_rest_minutes: intervalMinutes,
      });

      expect(violations.interjornada_violation_minutes).toBe(180); // 660 - 480 = 180 min suprimidos
      expect(violations.inconsistencies).toContain('INTERJORNADA_VIOLATION');
    });

    it('não deve apontar violação quando descansos e intervalos cumprirem a legislação', () => {
      const violations = calculateDailyViolations({
        expected_work_minutes: 480,
        worked_minutes: 480,
        break_expected_minutes: 60,
        break_taken_minutes: 60,
        interjornada_rest_minutes: 720, // 12 horas (> 11h)
      });

      expect(violations.intrajornada_violation_minutes).toBe(0);
      expect(violations.interjornada_violation_minutes).toBe(0);
      expect(violations.inconsistencies).toHaveLength(0);
    });
  });

  describe('5. Validação da Migration 00077_time_tracking_pt01.sql', () => {
    it('o arquivo de migration deve existir e conter as estruturas mandatórias de PT-01', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/00077_time_tracking_pt01.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

      // Tabelas criadas
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.time_devices');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.afd_files');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.time_punch_records');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.time_daily_summary');

      // Alterações em tabelas existentes
      expect(sqlContent).toContain('punch_record_id');
      expect(sqlContent).toContain('policy_type');
      expect(sqlContent).toContain('validity_months');
      expect(sqlContent).toContain('expiration_rule');

      // Imutabilidade de batidas (trigger proibindo UPDATE/DELETE)
      expect(sqlContent).toContain('prevent_punch_record_mutation');
      expect(sqlContent).toContain('trg_immutable_time_punch_records');

      // RLS habilitado em todas
      expect(sqlContent).toContain('ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY');
      expect(sqlContent).toContain('ALTER TABLE public.afd_files ENABLE ROW LEVEL SECURITY');
      expect(sqlContent).toContain('ALTER TABLE public.time_punch_records ENABLE ROW LEVEL SECURITY');
      expect(sqlContent).toContain('ALTER TABLE public.time_daily_summary ENABLE ROW LEVEL SECURITY');

      // Auditoria em todas
      expect(sqlContent).toContain('audit_time_devices_trigger');
      expect(sqlContent).toContain('audit_afd_files_trigger');
      expect(sqlContent).toContain('audit_time_punch_records_trigger');
      expect(sqlContent).toContain('audit_time_daily_summary_trigger');
    });
  });
});
