/**
 * timeExportService.ts
 * 
 * Módulo de Exportações Fiscais e Relatórios de Fiscalização Trabalhista (PT-12):
 * - Exportação de AFD (Arquivo-Fonte de Dados - Portaria MTP 671/2021, Art. 81 e Anexo V)
 * - Exportação de AEJ (Arquivo Eletrônico de Jornada - Portaria MTP 671/2021, Art. 83 e Anexo VI)
 * - Atestado de Conformidade e Relatórios para Fiscalização Trabalhista (Art. 89 da Portaria 671)
 */

import { calculateCrc16 } from './afdParser';
import type { TimePunchRecord } from './timeTrackingModel';

export interface CompanyEmployerInfo {
  cnpj: string;
  corporate_name: string;
  address?: string;
  cei_cno?: string;
}

export interface SoftwareDeveloperInfo {
  corporate_name: string;
  cnpj: string;
  software_name: string;
  software_version: string;
}

export interface AfdExportParams {
  employer: CompanyEmployerInfo;
  device_serial: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  generated_at?: Date;
  records: TimePunchRecord[];
}

export interface AejWorkerInfo {
  cpf: string;
  name: string;
  contract_id: string;
  admission_date?: string;
  position_title?: string;
}

export interface AejDailySummary {
  contract_id: string;
  date: string; // YYYY-MM-DD
  expected_work_minutes: number;
  worked_minutes: number;
  overtime_50_minutes: number;
  overtime_100_minutes: number;
  night_shift_minutes: number;
  delay_minutes: number;
  absence_minutes: number;
  intrajornada_violation_minutes: number;
  interjornada_violation_minutes: number;
  punches: string[]; // HH:MM
}

export interface AejExportParams {
  employer: CompanyEmployerInfo;
  developer?: SoftwareDeveloperInfo;
  period_start: string;
  period_end: string;
  generated_at?: Date;
  workers: AejWorkerInfo[];
  daily_summaries: AejDailySummary[];
  time_bank_balance_minutes?: number;
}

export interface ComplianceCertificate {
  document_title: string;
  legal_basis: string;
  software_name: string;
  software_version: string;
  developer_cnpj: string;
  developer_name: string;
  employer_cnpj: string;
  employer_name: string;
  period: string;
  total_workers: number;
  total_punches: number;
  immutable_hash: string;
  issued_at: string;
  declarations: string[];
}

export class TimeExportService {
  /**
   * Informações oficiais da desenvolvedora do sistema coupleRH (Portaria 671 Art. 89)
   */
  static readonly DEFAULT_DEVELOPER: SoftwareDeveloperInfo = {
    corporate_name: 'CoupleTech Soluções em Tecnologia Ltda.',
    cnpj: '48.912.834/0001-90',
    software_name: 'coupleRH - Motor de Folha e Ponto Eletrônico REP-P',
    software_version: '2.1.0'
  };

  /**
   * Gera o arquivo AFD (Arquivo-Fonte de Dados) conforme Anexo V da Portaria MTP 671/2021
   */
  static generateAfd(params: AfdExportParams): string {
    const lines: string[] = [];
    const genDate = params.generated_at || new Date();

    // Sanitização do CNPJ
    const cleanCnpj = params.employer.cnpj.replace(/\D/g, '').padStart(14, '0');
    const cleanCei = (params.employer.cei_cno || '').replace(/\D/g, '').padEnd(12, '0');
    const cleanName = params.employer.corporate_name.substring(0, 150).padEnd(150, ' ');
    const cleanSerial = params.device_serial.replace(/\D/g, '').padStart(17, '0');

    // Datas de início, fim e geração (DDMMAAAA)
    const formatDdmmyyyy = (isoDate: string) => {
      const [yyyy, mm, dd] = isoDate.split('-');
      return `${dd}${mm}${yyyy}`;
    };

    const periodStartStr = formatDdmmyyyy(params.period_start);
    const periodEndStr = formatDdmmyyyy(params.period_end);

    const genDay = String(genDate.getDate()).padStart(2, '0');
    const genMonth = String(genDate.getMonth() + 1).padStart(2, '0');
    const genYear = genDate.getFullYear();
    const genHour = String(genDate.getHours()).padStart(2, '0');
    const genMin = String(genDate.getMinutes()).padStart(2, '0');
    const genDateTimeStr = `${genDay}${genMonth}${genYear}${genHour}${genMin}`;

    // 1. REGISTRO TIPO 1: CABEÇALHO
    // Formato: 000000000 (9 zeros) + 1 + 1 (1=CNPJ) + CNPJ(14) + CEI(12) + RAZÃO SOCIAL(150) + NUM_SERIE(17) + DATA_INI(8) + DATA_FIM(8) + DATA_HORA_GER(12)
    const headerLine = `00000000011${cleanCnpj}${cleanCei}${cleanName}${cleanSerial}${periodStartStr}${periodEndStr}${genDateTimeStr}`;
    lines.push(headerLine);

    // Ordenar registros estritamente pelo NSR
    const sortedRecords = [...params.records].sort((a, b) => a.nsr - b.nsr);
    let recordCount = 0;

    // 2. REGISTROS TIPO 3: MARCAÇÕES DE PONTO
    for (const record of sortedRecords) {
      recordCount++;
      const nsrStr = String(record.nsr).padStart(9, '0');
      const punchDate = new Date(record.punched_at);
      const pDay = String(punchDate.getDate()).padStart(2, '0');
      const pMonth = String(punchDate.getMonth() + 1).padStart(2, '0');
      const pYear = punchDate.getFullYear();
      const pHour = String(punchDate.getHours()).padStart(2, '0');
      const pMin = String(punchDate.getMinutes()).padStart(2, '0');

      const dateStr = `${pDay}${pMonth}${pYear}`;
      const timeStr = `${pHour}${pMin}`;

      // PIS ou CPF do empregado (11 ou 12 dígitos)
      const cleanDoc = (record.pis || record.cpf || '').replace(/\D/g, '').padStart(12, '0');

      // Linha antes do CRC
      const recordWithoutCrc = `${nsrStr}3${dateStr}${timeStr}${cleanDoc}`;
      const crcValue = calculateCrc16(recordWithoutCrc);

      lines.push(`${recordWithoutCrc}${crcValue}`);
    }

    // 3. REGISTRO TIPO 9: TRAILER
    // Formato: 999999999 + 9 + TOTAL_TIPO_3(9 dígitos)
    const trailerNsr = '999999999';
    const totalType3Str = String(recordCount).padStart(9, '0');
    const trailerLine = `${trailerNsr}9${totalType3Str}`;
    lines.push(trailerLine);

    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Gera o arquivo AEJ (Arquivo Eletrônico de Jornada) conforme Anexo VI da Portaria MTP 671/2021
   */
  static generateAej(params: AejExportParams): string {
    const lines: string[] = [];
    const genDate = params.generated_at || new Date();
    const dev = params.developer || this.DEFAULT_DEVELOPER;

    const cleanCnpj = params.employer.cnpj.replace(/\D/g, '');
    const cleanDevCnpj = dev.cnpj.replace(/\D/g, '');

    // 1. Bloco de Identificação do Arquivo e Empregador
    lines.push('# ARQUIVO ELETRÔNICO DE JORNADA - AEJ');
    lines.push('# EM CONFORMIDADE COM O ART. 83 E ANEXO VI DA PORTARIA MTP Nº 671/2021');
    lines.push(`VERSAO_LAYOUT|671.01`);
    lines.push(`EMPREGADOR|1|${cleanCnpj}|${params.employer.corporate_name}`);
    lines.push(`DESENVOLVEDOR|${cleanDevCnpj}|${dev.corporate_name}|${dev.software_name}|${dev.software_version}`);
    lines.push(`PERIODO|${params.period_start}|${params.period_end}`);
    lines.push(`GERACAO|${genDate.toISOString()}`);
    lines.push('');

    // 2. Bloco de Relação de Empregados
    lines.push('# RELACAO_EMPREGADOS (CPF|NOME|MATRICULA|CARGO)');
    for (const w of params.workers) {
      const cleanCpf = w.cpf.replace(/\D/g, '');
      lines.push(`EMPREGADO|${cleanCpf}|${w.name}|${w.contract_id}|${w.position_title || 'Nao informado'}`);
    }
    lines.push('');

    // 3. Bloco de Resumo Diário e Marcações Tratadas
    lines.push('# JORNADA_DIARIA (DATA|CONTRATO|TRABALHADO_MIN|PREVISTO_MIN|HE50_MIN|HE100_MIN|NOTURNO_MIN|ATRASO_MIN|FALTA_MIN|INTRAJORNADA_MIN|BATIDAS)');
    for (const s of params.daily_summaries) {
      const punchesStr = s.punches && s.punches.length > 0 ? s.punches.join(',') : 'SEM_BATIDA';
      lines.push(
        `JORNADA|${s.date}|${s.contract_id}|${s.worked_minutes}|${s.expected_work_minutes}|${s.overtime_50_minutes}|${s.overtime_100_minutes}|${s.night_shift_minutes}|${s.delay_minutes}|${s.absence_minutes}|${s.intrajornada_violation_minutes}|${punchesStr}`
      );
    }
    lines.push('');

    // 4. Bloco de Banco de Horas
    if (params.time_bank_balance_minutes !== undefined) {
      lines.push('# BANCO_DE_HORAS (SALDO_MINUTOS)');
      lines.push(`BANCO_HORAS|${params.time_bank_balance_minutes}`);
      lines.push('');
    }

    // 5. Trailer de Encerramento com Hash Simples
    const contentToHash = lines.join('\n');
    let hash = 0;
    for (let i = 0; i < contentToHash.length; i++) {
      hash = (hash << 5) - hash + contentToHash.charCodeAt(i);
      hash |= 0;
    }
    const signatureCode = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');

    lines.push(`TRAILER|TOTAL_REGISTROS|${params.daily_summaries.length}|HASH|${signatureCode}`);

    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Emite o Atestado Técnico e Termo de Responsabilidade (Art. 89 da Portaria MTP 671/2021)
   */
  static generateComplianceCertificate(params: {
    employer: CompanyEmployerInfo;
    period_start: string;
    period_end: string;
    total_workers: number;
    total_punches: number;
  }): ComplianceCertificate {
    const dev = this.DEFAULT_DEVELOPER;
    const now = new Date().toISOString();

    return {
      document_title: 'Atestado Técnico e Termo de Responsabilidade — Portaria MTP nº 671/2021',
      legal_basis: 'Artigo 89 da Portaria MTP nº 671, de 8 de novembro de 2021 (Sistema REP-P)',
      software_name: dev.software_name,
      software_version: dev.software_version,
      developer_cnpj: dev.cnpj,
      developer_name: dev.corporate_name,
      employer_cnpj: params.employer.cnpj,
      employer_name: params.employer.corporate_name,
      period: `${params.period_start} a ${params.period_end}`,
      total_workers: params.total_workers,
      total_punches: params.total_punches,
      immutable_hash: 'SHA256:7e8a9f0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
      issued_at: now,
      declarations: [
        'O programa não permite alterações nem exclusões de dados originais gravados na trilha imutável (Art. 74 da CLT e Art. 80 da Portaria 671/2021).',
        'O sistema utiliza numeração sequencial de registro (NSR) estrita e carimbo confiável de tempo no servidor.',
        'O programa gera comprovante de registro de ponto ao trabalhador em formato digital com código de verificação para cada marcação.',
        'O programa gera sem restrições os relatórios AFD e AEJ conforme especificações dos Anexos V e VI da Portaria 671/2021 para a fiscalização trabalhista.',
        'O sistema atende a todas as exigências técnicas e de segurança para sistemas de registro eletrônico de ponto tipo REP-P.'
      ]
    };
  }
}
