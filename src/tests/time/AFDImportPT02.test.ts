import { describe, it, expect } from 'vitest';
import { parseAfdContent, calculateCrc16, calculateFileSha256 } from '../../services/timeTracking/afdParser';
import { processAfdImport, type AfdImportParams } from '../../services/timeTracking/afdImportService';

describe('PT-02: Importação de AFD (Portaria MTP 671/2021)', () => {
  // Exemplo de AFD padrão Portaria 671 / 1510
  // Linha 1: Tipo 1 (Header): NSR 000000001, Tipo 1, Identificador 1 (CNPJ), CNPJ 12345678000195, Razão Social, Série REP 00004003789999999, Período 01102026 a 14102026
  // Linha 2 e 3: Tipo 3 (Marcações): NSR, Tipo 3, Data (DDMMAAAA), Hora (HHMM), PIS/CPF (12 dígitos ou 11 dígitos com zero)
  const sampleAfdContent = [
    '0000000011112345678000195EMPRESA EXEMPLO LTDA                 000040037899999990110202614102026141020261000',
    '0000000023141020260800123456789010',
    '0000000033141020261200123456789010',
    '0000000043141020261300123456789010',
    '0000000053141020261800123456789010',
  ].join('\n');

  describe('1. Parser de AFD (afdParser)', () => {
    it('deve extrair dados do cabeçalho (Registro Tipo 1) com sucesso', () => {
      const parsed = parseAfdContent(sampleAfdContent);
      expect(parsed.header).toBeDefined();
      expect(parsed.header?.employerCnpj).toBe('12345678000195');
      expect(parsed.header?.repSerialNumber).toBe('00004003789999999');
      expect(parsed.header?.companyName?.trim()).toBe('EMPRESA EXEMPLO LTDA');
      expect(parsed.header?.periodStart).toBe('2026-10-01');
      expect(parsed.header?.periodEnd).toBe('2026-10-14');
    });

    it('deve extrair marcações de ponto (Registro Tipo 3) corretamente', () => {
      const parsed = parseAfdContent(sampleAfdContent);
      expect(parsed.punchRecords).toHaveLength(4);

      const firstPunch = parsed.punchRecords[0];
      expect(firstPunch.nsr).toBe(2);
      expect(firstPunch.date).toBe('2026-10-14');
      expect(firstPunch.time).toBe('08:00');
      expect(firstPunch.punched_at).toBe('2026-10-14T08:00:00-03:00');
      expect(firstPunch.cpfOrPis).toBe('123456789010');
    });

    it('deve calcular o hash SHA-256 do arquivo para controle de idempotência', () => {
      const hash1 = calculateFileSha256(sampleAfdContent);
      const hash2 = calculateFileSha256(sampleAfdContent);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve calcular e validar CRC-16 de linhas de registro de ponto', () => {
      const lineWithoutCrc = '0000000023141020260800123456789010';
      const crcHex = calculateCrc16(lineWithoutCrc);
      expect(crcHex).toHaveLength(4);

      const lineWithCrc = `${lineWithoutCrc}${crcHex}`;
      const parsed = parseAfdContent(lineWithCrc);
      expect(parsed.punchRecords[0].crc_ok).toBe(true);
    });

    it('deve detectar lacuna de NSR na sequência do arquivo AFD', () => {
      const afdWithNsrGap = [
        '0000000011112345678000195EMPRESA EXEMPLO LTDA                 000040037899999990110202614102026141020261000',
        '0000000023141020260800123456789010',
        '0000000053141020261200123456789010', // Salto do NSR 2 para 5 (lacuna de 2 registros: 3 e 4)
      ].join('\n');

      const parsed = parseAfdContent(afdWithNsrGap);
      expect(parsed.warnings).toContain(
        'Lacuna de NSR detectada: salto do NSR 2 para o NSR 5 (possíveis registros ausentes).'
      );
    });
  });

  describe('2. Ingestão e Serviço de Importação (afdImportService)', () => {
    const mockContext: AfdImportParams = {
      tenant_id: 'tenant-001',
      company_id: 'company-001',
      device_id: 'device-rep-01',
      companyCnpj: '12.345.678/0001-95',
      workers: [
        {
          id: 'worker-1',
          person_id: 'person-1',
          cpf: '12345678901',
          pis: '123456789010',
          active_contract_id: 'contract-1',
        },
      ],
      existingAfdHashes: new Set<string>(),
      existingPunches: new Set<string>(), // set com strings "device_id:nsr"
    };

    it('deve importar arquivo AFD vinculando colaborador por PIS/CPF e gerando relatório completo', async () => {
      const result = await processAfdImport(sampleAfdContent, 'afd_outubro_2026.txt', mockContext);

      expect(result.status).toBe('SUCCESS');
      expect(result.report.total_records).toBe(5); // 1 header + 4 batidas
      expect(result.report.imported_records).toBe(4);
      expect(result.report.duplicate_records).toBe(0);
      expect(result.report.rejected_records).toBe(0);

      // Todas as 4 batidas devem estar associadas ao worker-1 e contract-1
      expect(result.recordsToInsert).toHaveLength(4);
      expect(result.recordsToInsert[0].worker_id).toBe('worker-1');
      expect(result.recordsToInsert[0].contract_id).toBe('contract-1');
      expect(result.recordsToInsert[0].source).toBe('IMPORT');
    });

    it('deve garantir idempotência em nível de arquivo: rejeitar arquivo já importado', async () => {
      const fileHash = calculateFileSha256(sampleAfdContent);
      const contextWithImportedFile: AfdImportParams = {
        ...mockContext,
        existingAfdHashes: new Set([fileHash]),
      };

      const result = await processAfdImport(sampleAfdContent, 'afd_duplicado.txt', contextWithImportedFile);

      expect(result.status).toBe('ALREADY_IMPORTED');
      expect(result.errors).toContain(
        'Este arquivo AFD já foi importado anteriormente para este tenant (idempotência garantida).'
      );
      expect(result.recordsToInsert).toHaveLength(0);
    });

    it('deve garantir idempotência em nível de batida: ignorar registros com par (device_id, nsr) já existente', async () => {
      // Suponha que os NSRs 2 e 3 já foram importados anteriormente
      const contextWithExistingPunches: AfdImportParams = {
        ...mockContext,
        existingPunches: new Set(['device-rep-01:2', 'device-rep-01:3']),
      };

      const result = await processAfdImport(sampleAfdContent, 'afd_parcial.txt', contextWithExistingPunches);

      expect(result.status).toBe('SUCCESS');
      expect(result.report.imported_records).toBe(2); // Apenas os NSRs 4 e 5 novos
      expect(result.report.duplicate_records).toBe(2); // NSRs 2 e 3 ignorados como duplicados
      expect(result.recordsToInsert).toHaveLength(2);
      expect(result.recordsToInsert.map((r) => r.nsr)).toEqual([4, 5]);
    });

    it('deve registrar batida como aceita mesmo se colaborador não for encontrado, emitindo warning no relatório', async () => {
      const contextWithoutWorkers: AfdImportParams = {
        ...mockContext,
        workers: [], // Nenhum colaborador cadastrado com esse PIS/CPF
      };

      const result = await processAfdImport(sampleAfdContent, 'afd_sem_worker.txt', contextWithoutWorkers);

      expect(result.status).toBe('SUCCESS');
      expect(result.report.imported_records).toBe(4);
      // As batidas são salvas para não violar a Portaria 671, mas worker_id fica null
      expect(result.recordsToInsert[0].worker_id).toBeUndefined();
      expect(result.report.warnings.some((w) => w.includes('Colaborador não localizado'))).toBe(true);
    });

    it('deve rejeitar importação se CNPJ do arquivo diferir da empresa do contexto', async () => {
      const contextWithDifferentCnpj: AfdImportParams = {
        ...mockContext,
        companyCnpj: '99.888.777/0001-11', // CNPJ diferente do arquivo (12345678000195)
      };

      const result = await processAfdImport(sampleAfdContent, 'afd_outro_cnpj.txt', contextWithDifferentCnpj);

      expect(result.status).toBe('VALIDATION_ERROR');
      expect(result.errors.some((e) => e.includes('Divergência de CNPJ'))).toBe(true);
      expect(result.recordsToInsert).toHaveLength(0);
    });
  });
});
