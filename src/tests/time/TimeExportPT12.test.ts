import { describe, it, expect } from 'vitest';
import {
  TimeExportService,
  AfdExportParams,
  AejExportParams
} from '../../services/timeTracking/timeExportService';
import { TimePunchRecord } from '../../services/timeTracking/timeTrackingModel';
import { calculateCrc16 } from '../../services/timeTracking/afdParser';

describe('FASE P5: PT-12 — Exportações AFD e AEJ e Relatórios para Fiscalização (Portaria MTP 671/2021)', () => {
  const mockEmployer = {
    cnpj: '12.345.678/0001-95',
    corporate_name: 'Empresa Teste coupleRH Ltda'
  };

  describe('1. Exportação do Arquivo-Fonte de Dados (AFD - Portaria 671 Art. 81 e Anexo V)', () => {
    it('deve gerar cabeçalho Tipo 1, registros Tipo 3 com CRC-16 e trailer Tipo 9', () => {
      const mockRecords: TimePunchRecord[] = [
        {
          nsr: 1,
          record_type: 3,
          punched_at: '2026-03-02T08:00:00-03:00',
          cpf: '12345678901',
          pis: '12345678901',
          source: 'REP',
          tenant_id: 't1'
        },
        {
          nsr: 2,
          record_type: 3,
          punched_at: '2026-03-02T12:00:00-03:00',
          cpf: '12345678901',
          pis: '12345678901',
          source: 'REP',
          tenant_id: 't1'
        }
      ];

      const params: AfdExportParams = {
        employer: mockEmployer,
        device_serial: '0000000000000001',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        generated_at: new Date('2026-04-01T10:00:00'),
        records: mockRecords
      };

      const afdContent = TimeExportService.generateAfd(params);
      const lines = afdContent.split('\r\n').filter(Boolean);

      // Deve ter exatamente 4 linhas: Cabeçalho (1), Batida 1 (3), Batida 2 (3), Trailer (9)
      expect(lines).toHaveLength(4);

      // Linha 1: Tipo 1 (Cabeçalho)
      const header = lines[0];
      expect(header.startsWith('00000000011')).toBe(true);
      expect(header).toContain('12345678000195'); // CNPJ limpo

      // Linhas 2 e 3: Tipo 3 (Marcações)
      const linePunch1 = lines[1];
      expect(linePunch1.startsWith('0000000013')).toBe(true);
      // Validar que o CRC-16 no final confere
      const lineContentWithoutCrc = linePunch1.substring(0, linePunch1.length - 4);
      const expectedCrc = calculateCrc16(lineContentWithoutCrc);
      expect(linePunch1.endsWith(expectedCrc)).toBe(true);

      // Linha 4: Tipo 9 (Trailer)
      const trailer = lines[3];
      expect(trailer.startsWith('9999999999')).toBe(true);
      expect(trailer.endsWith('000000002')).toBe(true); // Total de 2 batidas
    });

    it('deve ordenar registros rigorosamente pelo NSR mesmo se fornecidos fora de ordem', () => {
      const recordsOutOfOrder: TimePunchRecord[] = [
        { nsr: 5, record_type: 3, punched_at: '2026-03-02T18:00:00Z', cpf: '111', source: 'MOBILE', tenant_id: 't1' },
        { nsr: 2, record_type: 3, punched_at: '2026-03-02T09:00:00Z', cpf: '111', source: 'MOBILE', tenant_id: 't1' },
        { nsr: 4, record_type: 3, punched_at: '2026-03-02T13:00:00Z', cpf: '111', source: 'MOBILE', tenant_id: 't1' }
      ];

      const afdContent = TimeExportService.generateAfd({
        employer: mockEmployer,
        device_serial: '0000000000000001',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        records: recordsOutOfOrder
      });

      const lines = afdContent.split('\r\n').filter(Boolean);
      expect(lines[1].startsWith('0000000023')).toBe(true);
      expect(lines[2].startsWith('0000000043')).toBe(true);
      expect(lines[3].startsWith('0000000053')).toBe(true);
    });
  });

  describe('2. Exportação do Arquivo Eletrônico de Jornada (AEJ - Portaria 671 Art. 83 e Anexo VI)', () => {
    it('deve gerar o arquivo AEJ contendo empregador, desenvolvedor, colaboradores e jornada diária', () => {
      const aejParams: AejExportParams = {
        employer: mockEmployer,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        generated_at: new Date('2026-04-01T12:00:00'),
        workers: [
          {
            cpf: '123.456.789-00',
            name: 'Carlos da Silva',
            contract_id: 'ctr-001',
            position_title: 'Analista de Sistemas'
          }
        ],
        daily_summaries: [
          {
            contract_id: 'ctr-001',
            date: '2026-03-02',
            expected_work_minutes: 480,
            worked_minutes: 540,
            overtime_50_minutes: 60,
            overtime_100_minutes: 0,
            night_shift_minutes: 0,
            delay_minutes: 0,
            absence_minutes: 0,
            intrajornada_violation_minutes: 0,
            interjornada_violation_minutes: 0,
            punches: ['08:00', '12:00', '13:00', '18:00']
          }
        ],
        time_bank_balance_minutes: 120
      };

      const aejContent = TimeExportService.generateAej(aejParams);

      expect(aejContent).toContain('VERSAO_LAYOUT|671.01');
      expect(aejContent).toContain('EMPREGADOR|1|12345678000195|Empresa Teste coupleRH Ltda');
      expect(aejContent).toContain('DESENVOLVEDOR|');
      expect(aejContent).toContain('coupleRH - Motor de Folha e Ponto Eletrônico REP-P');
      expect(aejContent).toContain('EMPREGADO|12345678900|Carlos da Silva|ctr-001|Analista de Sistemas');
      expect(aejContent).toContain('JORNADA|2026-03-02|ctr-001|540|480|60|0|0|0|0|0|08:00,12:00,13:00,18:00');
      expect(aejContent).toContain('BANCO_HORAS|120');
      expect(aejContent).toContain('TRAILER|TOTAL_REGISTROS|1|HASH|');
    });
  });

  describe('3. Atestado Técnico e Termo de Responsabilidade (Portaria 671 Art. 89)', () => {
    it('deve emitir o atestado técnico com todas as garantias de integridade do REP-P', () => {
      const certificate = TimeExportService.generateComplianceCertificate({
        employer: mockEmployer,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        total_workers: 15,
        total_punches: 620
      });

      expect(certificate.document_title).toContain('Portaria MTP nº 671/2021');
      expect(certificate.developer_name).toBe('CoupleTech Soluções em Tecnologia Ltda.');
      expect(certificate.software_name).toContain('coupleRH');
      expect(certificate.declarations.length).toBeGreaterThanOrEqual(4);
      expect(certificate.declarations.some((d) => d.includes('não permite alterações nem exclusões de dados originais'))).toBe(true);
    });
  });
});
