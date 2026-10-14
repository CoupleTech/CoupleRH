import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AfdImportService } from '../../services/timeTracking/afdImportService';
import { supabase } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

// Mock do supabase
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-admin-123' } }
        })
      },
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    }
  };
});

describe('AfdImportService.importAfdFile - Testes de Integração e Persistência', () => {
  const sampleAfd = [
    '0000000001126355335000116000000000000GUSTAVO CASEMIRO DO NASCIMENTO                                                                                                                        0001400371000823701012001141020261410202609278dee',
    '0000000143231220221120016219753683a8dc',
    '00000002832612202215240023456789015468',
    '0000000303261220221525128730258780e23c',
    '9999999990000000000000000030000000000000000000000000000000',
    'WVZ/qHABamAZ/zoLWWpAHD+JJ297Up5UxLSpgZ3PCWm+nNIPwMebIybo4he2jqIOCgfVhA/pX4ZXWbYm+8Mtyg=='
  ].join('\n');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar erro se parâmetros essenciais estiverem ausentes', async () => {
    const res = await AfdImportService.importAfdFile({
      tenant_id: '',
      file_name: 'teste.txt',
      file_content: ''
    });

    expect(res.success).toBe(false);
    expect(res.error_message).toContain('Parâmetros obrigatórios ausentes');
  });

  it('deve barrar importação duplicada se o hash do arquivo já existir em afd_files (idempotência)', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'afd_files') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'file-1', file_name: 'teste.txt', created_at: '2026-10-14T10:00:00Z' }
          })
        };
      }
      return {};
    });

    const res = await AfdImportService.importAfdFile({
      tenant_id: 'tenant-123',
      file_name: 'teste.txt',
      file_content: sampleAfd
    });

    expect(res.success).toBe(false);
    expect(res.error_message).toContain('Arquivo já importado anteriormente');
    expect(res.file_hash).toBeDefined();
  });

  it('deve processar e persistir o arquivo AFD no banco com criação de dispositivo e vínculo de colaboradores', async () => {
    const insertedPunches: any[] = [];
    const insertedAfdFiles: any[] = [];
    let updatedDevice: any = null;

    (supabase.from as any).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation((payload) => {
          updatedDevice = payload;
          return builder;
        }),
        insert: vi.fn().mockImplementation((payload) => {
          if (table === 'time_punch_records') {
            insertedPunches.push(...(Array.isArray(payload) ? payload : [payload]));
          } else if (table === 'afd_files') {
            insertedAfdFiles.push(payload);
          }
          return builder;
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'afd_files') return Promise.resolve({ data: null });
          if (table === 'companies') return Promise.resolve({ data: { cnpj: '26.355.335/0001-16' } });
          if (table === 'time_devices') return Promise.resolve({ data: null });
          return Promise.resolve({ data: null });
        }),
        single: vi.fn().mockImplementation(() => {
          if (table === 'time_devices') {
            return Promise.resolve({ data: { id: 'device-rep-00014003710008237' }, error: null });
          }
          return Promise.resolve({ data: {}, error: null });
        }),
        then: (resolve: any, reject: any) => {
          if (table === 'workers') {
            return Promise.resolve({
              data: [
                {
                  id: 'worker-fernanda',
                  person_id: 'person-fernanda',
                  people: { cpf: '01621975368' },
                  employment_contracts: [{ id: 'contract-fernanda', status: 'ACTIVE', pis: '016219753683' }]
                }
              ],
              error: null
            }).then(resolve, reject);
          }
          if (table === 'time_punch_records') {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
      };

      return builder;
    });

    const res = await AfdImportService.importAfdFile({
      tenant_id: 'tenant-123',
      company_id: 'company-casemiro',
      file_name: 'AFD00014003710008237.txt',
      file_content: sampleAfd
    });

    expect(res.success).toBe(true);
    expect(res.total_records).toBe(6); // 1 header + 3 batidas + 1 trailer + 1 assinatura
    expect(res.imported).toBe(3);
    expect(res.duplicates).toBe(0);
    expect(res.rejected).toBe(0);
    expect(supabase.rpc).toHaveBeenCalledWith('import_afd_punch_records', expect.objectContaining({
      p_tenant_id: 'tenant-123',
      p_company_id: 'company-casemiro'
    }));

    const rpcCall = (supabase.rpc as any).mock.calls[0];
    const punchesSent = rpcCall[1].p_punches;
    expect(punchesSent).toHaveLength(3);
    expect(punchesSent[0].worker_id).toBe('worker-fernanda');
    expect(punchesSent[0].contract_id).toBe('contract-fernanda');
    expect(punchesSent[0].nsr).toBe(14);
    expect(punchesSent[0].source).toBe('IMPORT');

    // Registro em afd_files efetuado
    expect(insertedAfdFiles).toHaveLength(1);
    expect(insertedAfdFiles[0].file_name).toBe('AFD00014003710008237.txt');
    expect(insertedAfdFiles[0].period_start).toBe('2001-01-01');
    expect(insertedAfdFiles[0].period_end).toBe('2026-10-14');

    // Atualizou last_nsr do dispositivo
    expect(updatedDevice).toBeDefined();
    expect(updatedDevice.last_nsr).toBe(30);
  });

  it('deve parsear o arquivo real do usuário de 19.625 linhas sem erros de sintaxe ou NSR', async () => {
    const userFilePath = 'C:/Users/cf95s/.gemini/antigravity-ide/brain/9b031211-69f1-475a-ad7b-312d8e4ea080/.user_uploaded/media_1792015332277.txt';
    if (!fs.existsSync(userFilePath)) return;

    const realContent = fs.readFileSync(userFilePath, 'utf8');

    (supabase.from as any).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder),
        insert: vi.fn().mockImplementation(() => builder),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'afd_files') return Promise.resolve({ data: null });
          if (table === 'time_devices') return Promise.resolve({ data: { id: 'device-id-real' } });
          return Promise.resolve({ data: null });
        }),
        single: vi.fn().mockResolvedValue({ data: { id: 'device-id-real' }, error: null }),
        then: (resolve: any, reject: any) => {
          if (table === 'workers') {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          if (table === 'time_punch_records') {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
      };
      return builder;
    });

    const res = await AfdImportService.importAfdFile({
      tenant_id: 'tenant-real',
      file_name: 'AFD_Real.txt',
      file_content: realContent
    });

    expect(res.success).toBe(true);
    expect(res.imported).toBe(18573);
    expect(res.total_records).toBe(19625);
    expect(res.duplicates).toBe(0);
  });
});
