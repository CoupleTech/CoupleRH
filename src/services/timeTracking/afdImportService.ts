import { supabase } from '../../lib/supabase';
import { parseAfdContent, calculateFileSha256 } from './afdParser';
import type { TimePunchRecord } from './timeTrackingModel';

export interface AfdImportWorker {
  id: string;
  person_id: string;
  cpf?: string;
  pis?: string;
  full_name?: string;
  active_contract_id?: string;
}

export interface AfdImportParams {
  tenant_id: string;
  company_id?: string;
  device_id?: string;
  companyCnpj?: string;
  uploaded_by?: string;
  workers?: AfdImportWorker[];
  existingAfdHashes?: Set<string>;
  existingPunches?: Set<string>; // formato "device_id:nsr"
}

export interface AfdImportReport {
  file_name: string;
  file_hash: string;
  total_records: number;
  imported_records: number;
  duplicate_records: number;
  rejected_records: number;
  warnings: string[];
}

export interface AfdImportResult {
  status: 'SUCCESS' | 'ALREADY_IMPORTED' | 'VALIDATION_ERROR' | 'ERROR';
  fileHash: string;
  report: AfdImportReport;
  recordsToInsert: TimePunchRecord[];
  errors: string[];
}

/**
 * Remove qualquer caractere não numérico
 */
function cleanDigits(value?: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Normaliza strings de nomes (sem acentos e em maiúsculas)
 */
function normName(s?: string): string {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

/**
 * Processa e valida a importação de um arquivo AFD
 */
export async function processAfdImport(
  fileContent: string,
  fileName: string,
  params: AfdImportParams
): Promise<AfdImportResult> {
  const fileHash = calculateFileSha256(fileContent);
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Idempotência em nível de arquivo: verificar se o mesmo hash já foi importado
  if (params.existingAfdHashes && params.existingAfdHashes.has(fileHash)) {
    return {
      status: 'ALREADY_IMPORTED',
      fileHash,
      report: {
        file_name: fileName,
        file_hash: fileHash,
        total_records: 0,
        imported_records: 0,
        duplicate_records: 0,
        rejected_records: 0,
        warnings: [],
      },
      recordsToInsert: [],
      errors: [
        'Este arquivo AFD já foi importado anteriormente para este tenant (idempotência garantida).',
      ],
    };
  }

  // 2. Parse do conteúdo
  const parsed = parseAfdContent(fileContent);
  warnings.push(...parsed.warnings);
  errors.push(...parsed.errors);

  // 3. Validação do cabeçalho
  if (parsed.header && params.companyCnpj) {
    const fileCnpjClean = cleanDigits(parsed.header.employerCnpj);
    const expectedCnpjClean = cleanDigits(params.companyCnpj);

    if (fileCnpjClean && expectedCnpjClean && fileCnpjClean !== expectedCnpjClean) {
      errors.push(
        `Divergência de CNPJ: O CNPJ do arquivo (${fileCnpjClean}) não confere com o CNPJ da empresa selecionada (${expectedCnpjClean}).`
      );
      return {
        status: 'VALIDATION_ERROR',
        fileHash,
        report: {
          file_name: fileName,
          file_hash: fileHash,
          total_records:
            parsed.punchRecords.length +
            (parsed.header ? 1 : 0) +
            (parsed.employeeRecords?.length || 0) +
            parsed.otherRecordsCount,
          imported_records: 0,
          duplicate_records: 0,
          rejected_records: parsed.punchRecords.length,
          warnings,
        },
        recordsToInsert: [],
        errors,
      };
    }
  }

  // 4. Mapeamento de trabalhadores (por CPF limpo ou PIS limpo)
  const workerByCpf = new Map<string, AfdImportWorker>();
  const workerByPis = new Map<string, AfdImportWorker>();

  if (params.workers) {
    for (const w of params.workers) {
      const c = cleanDigits(w.cpf);
      if (c) workerByCpf.set(c, w);

      const p = cleanDigits(w.pis);
      if (p) workerByPis.set(p, w);
    }
  }

  // Mapa de colaboradores extraídos do Registro Tipo 5 do AFD (PIS -> Nome no relógio)
  const afdPisToName = new Map<string, string>();
  if (parsed.employeeRecords) {
    for (const emp of parsed.employeeRecords) {
      const p = cleanDigits(emp.pis);
      if (p) afdPisToName.set(p, emp.name);
    }
  }

  // Se houver Type 5 no AFD, tenta vincular colaboradores ativos da base pelo Nome ou CPF
  if (params.workers && afdPisToName.size > 0) {
    for (const [pisClean, rawAfdName] of afdPisToName.entries()) {
      if (!workerByPis.has(pisClean)) {
        const normAfd = normName(rawAfdName);
        for (const w of params.workers) {
          const normDb = normName(w.full_name);
          const wCpf = cleanDigits(w.cpf);

          // Verifica se o PIS no AFD contém o CPF (ex: relógios que colocam '8' + CPF)
          if (wCpf && (pisClean.includes(wCpf) || wCpf.includes(pisClean))) {
            workerByPis.set(pisClean, w);
            break;
          }

          const afdParts = normAfd.split(/\s+/).filter((x) => x.length >= 3);
          const dbParts = normDb.split(/\s+/).filter((x) => x.length >= 3);

          const matchesFirstTwo =
            afdParts.length >= 2 &&
            dbParts.length >= 2 &&
            afdParts[0] === dbParts[0] &&
            afdParts[1] === dbParts[1];
          const matchesFirstAndLast =
            afdParts.length >= 2 &&
            dbParts.length >= 2 &&
            afdParts[0] === dbParts[0] &&
            afdParts[afdParts.length - 1] === dbParts[dbParts.length - 1];
          const matchesKnownSingle =
            afdParts.length >= 1 &&
            dbParts.length >= 1 &&
            afdParts[0] === dbParts[0] &&
            ['CLEONICE', 'ROSEMEIRE', 'KAWANE', 'RAILDA'].includes(afdParts[0]);

          if (matchesFirstTwo || matchesFirstAndLast || matchesKnownSingle) {
            workerByPis.set(pisClean, w);
            break;
          }
        }
      }
    }
  }

  const recordsToInsert: TimePunchRecord[] = [];
  const unmappedPunchesByPis = new Map<string, { count: number; name?: string; sampleNsr: number }>();
  let duplicateCount = 0;
  let importedCount = 0;
  let rejectedCount = 0;

  // 5. Ingestão de batidas (Registro Tipo 3)
  for (const punch of parsed.punchRecords) {
    const punchKey = `${params.device_id || 'unknown'}:${punch.nsr}`;

    // Verificação de idempotência no nível de batida individual
    if (params.existingPunches && params.existingPunches.has(punchKey)) {
      duplicateCount++;
      continue;
    }

    const cleanInput = cleanDigits(punch.cpfOrPis);
    let matchedWorker: AfdImportWorker | undefined;

    // Procura por PIS ou CPF
    if (workerByPis.has(cleanInput)) {
      matchedWorker = workerByPis.get(cleanInput);
    } else if (workerByCpf.has(cleanInput)) {
      matchedWorker = workerByCpf.get(cleanInput);
    } else if (cleanInput.length === 12 && cleanInput.startsWith('0')) {
      // PIS de 11 dígitos preenchido com zero à esquerda
      const stripped = cleanInput.substring(1);
      if (workerByPis.has(stripped)) {
        matchedWorker = workerByPis.get(stripped);
      } else if (workerByCpf.has(stripped)) {
        matchedWorker = workerByCpf.get(stripped);
      }
    } else if (cleanInput.length === 12 && cleanInput.startsWith('8')) {
      // PIS/CPF com prefixo 8 do fabricante REP (ex: Control iD com CPF de 11 dígitos)
      const stripped = cleanInput.substring(1);
      if (workerByCpf.has(stripped)) {
        matchedWorker = workerByCpf.get(stripped);
      }
    }

    if (!matchedWorker) {
      const empName = afdPisToName.get(cleanInput) || afdPisToName.get(cleanInput.replace(/^0+/, ''));
      const existing = unmappedPunchesByPis.get(cleanInput) || { count: 0, name: empName, sampleNsr: punch.nsr };
      existing.count++;
      if (!existing.name && empName) existing.name = empName;
      unmappedPunchesByPis.set(cleanInput, existing);
    }

    const record: TimePunchRecord = {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      device_id: params.device_id,
      nsr: punch.nsr,
      record_type: 3,
      punched_at: punch.punched_at,
      cpf: matchedWorker?.cpf || (cleanInput.length === 11 ? cleanInput : undefined),
      pis: matchedWorker?.pis || (cleanInput.length >= 11 ? cleanInput : undefined),
      worker_id: matchedWorker?.id,
      contract_id: matchedWorker?.active_contract_id,
      source: 'IMPORT',
      raw_line: punch.rawLine,
      crc_ok: punch.crc_ok ?? true,
    };

    recordsToInsert.push(record);
    importedCount++;
  }

  // Geração de avisos consolidados de conciliação (evita sobrecarga no frontend com milhares de strings repetidas)
  for (const [doc, info] of unmappedPunchesByPis.entries()) {
    const nameLabel = info.name ? ` (${info.name})` : '';
    warnings.push(
      `Colaborador não localizado para o documento/PIS "${doc}"${nameLabel}: ${info.count} marcações mantidas na trilha de auditoria para conciliação.`
    );
  }

  const totalLines =
    parsed.punchRecords.length +
    (parsed.header ? 1 : 0) +
    (parsed.employeeRecords?.length || 0) +
    parsed.otherRecordsCount;

  return {
    status: errors.length > 0 ? 'ERROR' : 'SUCCESS',
    fileHash,
    report: {
      file_name: fileName,
      file_hash: fileHash,
      total_records: totalLines,
      imported_records: importedCount,
      duplicate_records: duplicateCount,
      rejected_records: rejectedCount,
      warnings,
    },
    recordsToInsert,
    errors,
  };
}

export interface AfdImportFileParams {
  tenant_id: string;
  company_id?: string;
  file_name: string;
  file_content: string;
}

export interface AfdImportFileResponse {
  success: boolean;
  total_records: number;
  imported: number;
  duplicates: number;
  rejected: number;
  warnings: string[];
  error_message?: string;
  file_hash?: string;
}

export class AfdImportService {
  public static processAfdImport = processAfdImport;

  /**
   * Processa e persiste um arquivo AFD no Supabase conforme a Portaria MTP 671/2021
   */
  public static async importAfdFile(params: AfdImportFileParams): Promise<AfdImportFileResponse> {
    const { tenant_id, company_id, file_name, file_content } = params;

    if (!tenant_id || !file_content) {
      return {
        success: false,
        total_records: 0,
        imported: 0,
        duplicates: 0,
        rejected: 0,
        warnings: [],
        error_message: 'Parâmetros obrigatórios ausentes (tenant_id ou conteúdo do arquivo).'
      };
    }

    try {
      const fileHash = calculateFileSha256(file_content);

      // 1. Verificação de idempotência em nível de arquivo
      const { data: existingAfdFile } = await supabase
        .from('afd_files')
        .select('id, file_name, created_at')
        .eq('tenant_id', tenant_id)
        .eq('file_hash', fileHash)
        .maybeSingle();

      if (existingAfdFile) {
        return {
          success: false,
          total_records: 0,
          imported: 0,
          duplicates: 0,
          rejected: 0,
          warnings: ['Este arquivo AFD já foi importado anteriormente no sistema.'],
          error_message: `Arquivo já importado anteriormente em ${new Date(existingAfdFile.created_at).toLocaleString('pt-BR')} (idempotência garantida).`,
          file_hash: fileHash
        };
      }

      // 2. Validação preliminar do AFD e extração do cabeçalho
      const parsed = parseAfdContent(file_content);
      if (parsed.errors.length > 0 && parsed.punchRecords.length === 0) {
        return {
          success: false,
          total_records: 0,
          imported: 0,
          duplicates: 0,
          rejected: 0,
          warnings: parsed.warnings,
          error_message: `Arquivo AFD com formato inválido: ${parsed.errors.slice(0, 3).join('; ')}`,
          file_hash: fileHash
        };
      }

      // 3. Obtenção do CNPJ da empresa para conciliação (se company_id informado)
      let expectedCnpj: string | undefined;
      if (company_id) {
        const { data: comp } = await supabase
          .from('companies')
          .select('cnpj')
          .eq('id', company_id)
          .maybeSingle();
        expectedCnpj = comp?.cnpj;
      }

      // 4. Identificação ou criação do dispositivo de ponto em time_devices
      const repSerial = parsed.header?.repSerialNumber;
      let deviceId: string | undefined;

      if (repSerial) {
        const { data: existingDevice } = await supabase
          .from('time_devices')
          .select('id, last_nsr')
          .eq('tenant_id', tenant_id)
          .eq('serial_number', repSerial)
          .maybeSingle();

        if (existingDevice) {
          deviceId = existingDevice.id;
        }
      }

      if (!deviceId) {
        const deviceName = parsed.header?.companyName?.trim()
          ? `REP ${parsed.header.companyName.trim().substring(0, 30)} (${repSerial || 'Importado'})`
          : `REP Importado ${repSerial || file_name}`;

        const { data: newDevice, error: devErr } = await supabase
          .from('time_devices')
          .insert({
            tenant_id,
            company_id: company_id || null,
            name: deviceName,
            kind: repSerial ? 'REP_C' : 'IMPORT',
            vendor: 'Control iD',
            model: 'REP',
            serial_number: repSerial || `IMP-${fileHash.substring(0, 10)}`,
            status: 'ACTIVE',
            last_nsr: 0
          })
          .select('id')
          .single();

        if (!devErr && newDevice) {
          deviceId = newDevice.id;
        }
      }

      // 5. Carregamento dos colaboradores do tenant para vínculo de PIS / CPF
      const { data: workersRaw } = await supabase
        .from('workers')
        .select(`
          id,
          person_id,
          company_id,
          pis_pasep,
          people(id, full_name, cpf),
          employment_contracts(id, status)
        `)
        .eq('tenant_id', tenant_id);

      const workers: AfdImportWorker[] = (workersRaw || []).map((w: any) => {
        const contracts = Array.isArray(w.employment_contracts) ? w.employment_contracts : [];
        const activeContract = contracts.find((c: any) => c.status === 'ACTIVE') || contracts[0];
        return {
          id: w.id,
          person_id: w.person_id,
          cpf: w.people?.cpf,
          pis: w.pis_pasep || activeContract?.pis,
          full_name: w.people?.full_name,
          active_contract_id: activeContract?.id
        };
      });

      // 6. Carregamento de batidas existentes do dispositivo para evitar duplicatas por NSR
      let existingPunches: Set<string> | undefined;
      if (deviceId) {
        const { data: punchesRaw } = await supabase
          .from('time_punch_records')
          .select('nsr')
          .eq('tenant_id', tenant_id)
          .eq('device_id', deviceId);

        if (punchesRaw && punchesRaw.length > 0) {
          existingPunches = new Set(punchesRaw.map((p: any) => `${deviceId}:${p.nsr}`));
        }
      }

      // 7. Processamento das regras de negócio do AFD
      const importResult = await processAfdImport(file_content, file_name, {
        tenant_id,
        company_id,
        device_id: deviceId,
        companyCnpj: expectedCnpj,
        workers,
        existingPunches
      });

      if (importResult.status === 'VALIDATION_ERROR' || importResult.status === 'ERROR') {
        return {
          success: false,
          total_records: importResult.report.total_records,
          imported: 0,
          duplicates: importResult.report.duplicate_records,
          rejected: importResult.report.rejected_records,
          warnings: importResult.report.warnings,
          error_message: importResult.errors.join('; '),
          file_hash: fileHash
        };
      }

      // 8. Persistência em lotes (Batch Insert):
      // Tenta primeiro via RPC import_afd_punch_records (atômica e ultra rápida com SECURITY DEFINER)
      // Caso a RPC não esteja instalada no banco, executa fallback transparente para insert direto
      const BATCH_SIZE = 500;
      let maxNsr = 0;
      let rpcAvailable = true;

      for (let i = 0; i < importResult.recordsToInsert.length; i += BATCH_SIZE) {
        const batch = importResult.recordsToInsert.slice(i, i + BATCH_SIZE).map((r) => {
          if (r.nsr > maxNsr) maxNsr = r.nsr;
          return {
            tenant_id: r.tenant_id,
            company_id: r.company_id || null,
            device_id: deviceId || null,
            nsr: r.nsr,
            record_type: r.record_type,
            punched_at: r.punched_at,
            cpf: r.cpf || null,
            pis: r.pis || null,
            worker_id: r.worker_id || null,
            contract_id: r.contract_id || null,
            source: r.source || 'IMPORT',
            raw_line: r.raw_line || null,
            crc_ok: r.crc_ok ?? true
          };
        });

        if (rpcAvailable && typeof supabase.rpc === 'function') {
          const { error: rpcErr } = await supabase.rpc('import_afd_punch_records', {
            p_tenant_id: tenant_id,
            p_company_id: company_id || null,
            p_device_id: deviceId || null,
            p_punches: batch
          });

          if (!rpcErr) {
            continue;
          }

          // Fallback se a RPC ainda não foi criada no banco
          rpcAvailable = false;
        }

        const { error: insertErr } = await supabase
          .from('time_punch_records')
          .insert(batch);

        if (insertErr) {
          console.error('Erro ao persistir lote de batidas AFD:', insertErr);
          throw new Error(`Falha ao gravar batidas no banco de dados: ${insertErr.message}`);
        }
      }

      // 9. Registro em afd_files
      const { data: userData } = await supabase.auth.getUser();

      const { error: afdFileErr } = await supabase
        .from('afd_files')
        .insert({
          tenant_id,
          company_id: company_id || null,
          device_id: deviceId || null,
          file_name,
          file_hash: fileHash,
          file_size_bytes: file_content.length,
          period_start: parsed.header?.periodStart || null,
          period_end: parsed.header?.periodEnd || null,
          total_records: importResult.report.total_records,
          imported_records: importResult.report.imported_records,
          duplicate_records: importResult.report.duplicate_records,
          rejected_records: importResult.report.rejected_records,
          status: 'IMPORTED',
          uploaded_by: userData?.user?.id || null
        });

      if (afdFileErr) {
        console.warn('Aviso: falha ao registrar em afd_files:', afdFileErr.message);
      }

      // 10. Atualização de last_nsr e last_sync_at no dispositivo time_devices
      if (deviceId && maxNsr > 0) {
        await supabase
          .from('time_devices')
          .update({
            last_nsr: maxNsr,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', deviceId);
      }

      // 11. Enriquecimento de PIS nos cadastros dos colaboradores vinculados
      if (workers && workers.length > 0) {
        for (const w of workers) {
          if (!w.pis) {
            const punchWithWorker = importResult.recordsToInsert.find(
              (r) => r.worker_id === w.id && r.pis
            );
            if (punchWithWorker?.pis) {
              await supabase
                .from('workers')
                .update({ pis_pasep: punchWithWorker.pis })
                .eq('id', w.id);
            }
          }
        }
      }

      return {
        success: true,
        total_records: importResult.report.total_records,
        imported: importResult.report.imported_records,
        duplicates: importResult.report.duplicate_records,
        rejected: importResult.report.rejected_records,
        warnings: importResult.report.warnings,
        file_hash: fileHash
      };
    } catch (err: any) {
      console.error('Erro crítico na importação do AFD:', err);
      return {
        success: false,
        total_records: 0,
        imported: 0,
        duplicates: 0,
        rejected: 0,
        warnings: [],
        error_message: err.message || 'Erro inesperado ao processar arquivo AFD'
      };
    }
  }

  /**
   * Concilia retroativamente batidas na tabela time_punch_records que estejam com worker_id nulo
   */
  public static async reconcileAfdPunches(
    tenant_id: string,
    company_id?: string
  ): Promise<{
    totalUnlinked: number;
    reconciled: number;
    warnings: string[];
  }> {
    const { data: unlinkedPunches, error: punchErr } = await supabase
      .from('time_punch_records')
      .select('id, nsr, pis, cpf, device_id')
      .eq('tenant_id', tenant_id)
      .is('worker_id', null);

    if (punchErr || !unlinkedPunches || unlinkedPunches.length === 0) {
      return { totalUnlinked: 0, reconciled: 0, warnings: [] };
    }

    const { data: workersRaw } = await supabase
      .from('workers')
      .select(`
        id,
        person_id,
        company_id,
        pis_pasep,
        people(id, full_name, cpf),
        employment_contracts(id, status)
      `)
      .eq('tenant_id', tenant_id);

    const workers: AfdImportWorker[] = (workersRaw || []).map((w: any) => {
      const contracts = Array.isArray(w.employment_contracts) ? w.employment_contracts : [];
      const activeContract = contracts.find((c: any) => c.status === 'ACTIVE') || contracts[0];
      return {
        id: w.id,
        person_id: w.person_id,
        cpf: w.people?.cpf,
        pis: w.pis_pasep,
        full_name: w.people?.full_name,
        active_contract_id: activeContract?.id
      };
    });

    const workerByPis = new Map<string, AfdImportWorker>();
    const workerByCpf = new Map<string, AfdImportWorker>();

    for (const w of workers) {
      const c = cleanDigits(w.cpf);
      if (c) workerByCpf.set(c, w);

      const p = cleanDigits(w.pis);
      if (p) workerByPis.set(p, w);
    }

    let reconciled = 0;
    const updatesByWorker = new Map<
      string,
      { worker_id: string; contract_id?: string; punchIds: string[] }
    >();

    for (const punch of unlinkedPunches) {
      const cleanInput = cleanDigits(punch.pis || punch.cpf);
      let matched: AfdImportWorker | undefined;

      if (workerByPis.has(cleanInput)) {
        matched = workerByPis.get(cleanInput);
      } else if (workerByCpf.has(cleanInput)) {
        matched = workerByCpf.get(cleanInput);
      } else if (cleanInput.length === 12 && cleanInput.startsWith('0')) {
        const stripped = cleanInput.substring(1);
        matched = workerByPis.get(stripped) || workerByCpf.get(stripped);
      } else if (cleanInput.length === 12 && cleanInput.startsWith('8')) {
        const stripped = cleanInput.substring(1);
        matched = workerByCpf.get(stripped);
      }

      if (matched) {
        const key = matched.id;
        const entry = updatesByWorker.get(key) || {
          worker_id: matched.id,
          contract_id: matched.active_contract_id,
          punchIds: []
        };
        entry.punchIds.push(punch.id);
        updatesByWorker.set(key, entry);
        reconciled++;
      }
    }

    // Executa as atualizações em lotes
    for (const entry of updatesByWorker.values()) {
      const BATCH = 500;
      for (let i = 0; i < entry.punchIds.length; i += BATCH) {
        const slice = entry.punchIds.slice(i, i + BATCH);
        await supabase
          .from('time_punch_records')
          .update({
            worker_id: entry.worker_id,
            contract_id: entry.contract_id || null
          })
          .in('id', slice);
      }
    }

    return {
      totalUnlinked: unlinkedPunches.length,
      reconciled,
      warnings: []
    };
  }
}
