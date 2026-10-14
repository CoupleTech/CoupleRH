// Parser AFD conforme Portaria MTP 671/2021

export interface AfdHeader {
  nsr: number;
  recordType: number; // 1
  employerIdentifierType: number; // 1 = CNPJ, 2 = CPF
  employerCnpj?: string;
  employerCpf?: string;
  ceiCaepf?: string;
  companyName: string;
  repSerialNumber: string;
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string;   // YYYY-MM-DD
  generationDateTime?: string;
  rawLine: string;
}

export interface AfdPunchRecord {
  nsr: number;
  recordType: number; // 3
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  punched_at: string; // ISO 8601 com fuso
  cpfOrPis: string;
  crc?: string;
  crc_ok?: boolean;
  rawLine: string;
}

export interface AfdParseResult {
  header?: AfdHeader;
  punchRecords: AfdPunchRecord[];
  otherRecordsCount: number;
  warnings: string[];
  errors: string[];
  fileHash: string;
}

/**
 * Calcula o hash SHA-256 canônico em TypeScript puro sem dependência de módulos de SO
 */
export function calculateFileSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      const s1_ = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1_ + ch + k[i] + w[i]) | 0;
      const s0_ = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_ + maj) | 0;
      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Calcula CRC-16 padrão Portaria 671 / 1510 (Polinômio 0x1021 ou 0x8005)
 * Retorna string hexadecimal de 4 caracteres em maiúsculo
 */
export function calculateCrc16(data: string): string {
  let crc = 0x0000;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= code << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Converte data DDMMAAAA para YYYY-MM-DD
 */
function parseDateDDMMAAAA(d: string): string | undefined {
  if (!d || d.length !== 8) return undefined;
  const day = d.substring(0, 2);
  const month = d.substring(2, 4);
  const year = d.substring(4, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Converte horário HHMM para HH:mm
 */
function parseTimeHHMM(t: string): string | undefined {
  if (!t || t.length !== 4) return undefined;
  const hours = t.substring(0, 2);
  const minutes = t.substring(2, 4);
  return `${hours}:${minutes}`;
}

/**
 * Parser de Arquivo-Fonte de Dados (AFD) conforme Portaria MTP 671/2021
 */
export function parseAfdContent(content: string): AfdParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const warnings: string[] = [];
  const errors: string[] = [];
  const punchRecords: AfdPunchRecord[] = [];
  let header: AfdHeader | undefined;
  let otherRecordsCount = 0;

  let lastNsr: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.length < 10) continue;

    // Registro Tipo 9 - Trailer de encerramento padrão da Portaria 1510/671
    if (rawLine.startsWith('999999999')) {
      otherRecordsCount++;
      continue;
    }

    // Posições 1 a 9: NSR
    const nsrStr = rawLine.substring(0, 9);
    const nsr = parseInt(nsrStr, 10);
    if (isNaN(nsr)) {
      // Linhas não numéricas no rodapé (ex: assinatura digital ICP-Brasil em base64)
      if (rawLine.includes('==') || rawLine.includes('/') || rawLine.length >= 30) {
        otherRecordsCount++;
        continue;
      }
      errors.push(`Linha ${i + 1}: NSR inválido (${nsrStr})`);
      continue;
    }

    // Posição 10: Tipo de registro (1, 2, 3, 4, 5, 6)
    const recordTypeStr = rawLine.substring(9, 10);
    const recordType = parseInt(recordTypeStr, 10);

    // Verificação de lacuna de NSR
    if (lastNsr !== null && nsr > lastNsr + 1 && nsr !== 999999999) {
      warnings.push(
        `Lacuna de NSR detectada: salto do NSR ${lastNsr} para o NSR ${nsr} (possíveis registros ausentes).`
      );
    }
    lastNsr = nsr;

    if (recordType === 1) {
      // Registro 1: Cabeçalho
      // Posição 11: Tipo identificador (1=CNPJ, 2=CPF)
      // Posição 12 a 25: CNPJ/CPF (14 dígitos)
      // Posição 26 a 37: CEI/CAEPF (12 dígitos opcionais)
      // Posição 38 a 187: Razão Social ou Nome (tamanho variável / fixo)
      // Seguido por Número de Série do REP (17 dígitos), Período inicial (8), Período final (8), Data geração (12)
      const idType = parseInt(rawLine.substring(10, 11), 10) || 1;
      const cnpjCpf = rawLine.substring(11, 25);
      
      let companyName = '';
      let repSerialNumber = '';
      let periodStart: string | undefined;
      let periodEnd: string | undefined;
      let ceiCaepf: string | undefined;

      let remaining = rawLine.substring(25);
      // Extrai CEI/CAEPF de 12 dígitos se presente no layout tradicional
      if (/^\d{12}/.test(remaining)) {
        ceiCaepf = remaining.substring(0, 12);
        remaining = remaining.substring(12);
      }

      // Tentativa de extração por padrão posicional ou regex (17 dígitos série + 8 data ini + 8 data fim)
      const datesMatch = remaining.match(/(\d{17})(\d{8})(\d{8})/);
      if (datesMatch) {
        const serialIdx = remaining.indexOf(datesMatch[0]);
        companyName = remaining.substring(0, serialIdx).trim();
        repSerialNumber = datesMatch[1];
        periodStart = parseDateDDMMAAAA(datesMatch[2]);
        periodEnd = parseDateDDMMAAAA(datesMatch[3]);
      } else {
        companyName = remaining.trim();
      }

      header = {
        nsr,
        recordType: 1,
        employerIdentifierType: idType,
        employerCnpj: idType === 1 ? cnpjCpf : undefined,
        employerCpf: idType === 2 ? cnpjCpf : undefined,
        ceiCaepf,
        companyName,
        repSerialNumber,
        periodStart,
        periodEnd,
        rawLine,
      };
    } else if (recordType === 3) {
      // Registro 3: Marcação de Ponto
      // Posição 11 a 18: Data (DDMMAAAA)
      // Posição 19 a 22: Horário (HHMM)
      // Posição 23 a 34: PIS ou CPF (12 ou 11 dígitos)
      // Fim da linha (opcional): CRC-16 (4 caracteres hexadecimais)
      const dateStr = rawLine.substring(10, 18);
      const timeStr = rawLine.substring(18, 22);
      const date = parseDateDDMMAAAA(dateStr);
      const time = parseTimeHHMM(timeStr);

      if (!date || !time) {
        errors.push(`Linha ${i + 1} (NSR ${nsr}): Data ou horário inválido (${dateStr} ${timeStr})`);
        continue;
      }

      // Resto da linha contém o PIS/CPF e eventualmente o CRC
      const rest = rawLine.substring(22);
      let cpfOrPis = '';
      let crcHex: string | undefined;
      let crcOk: boolean | undefined = true;

      // Se rest tem mais de 12 caracteres (ex: 12 dígitos + 4 hexadecimais de CRC)
      if (rest.length >= 16) {
        cpfOrPis = rest.substring(0, rest.length - 4);
        crcHex = rest.substring(rest.length - 4);
        const lineContentToVerify = rawLine.substring(0, rawLine.length - 4);
        const calculatedCrc = calculateCrc16(lineContentToVerify);
        crcOk = calculatedCrc.toUpperCase() === crcHex.toUpperCase();
      } else {
        cpfOrPis = rest;
      }

      const punchedAt = `${date}T${time}:00-03:00`;

      punchRecords.push({
        nsr,
        recordType: 3,
        date,
        time,
        punched_at: punchedAt,
        cpfOrPis: cpfOrPis.trim(),
        crc: crcHex,
        crc_ok: crcOk,
        rawLine,
      });
    } else {
      otherRecordsCount++;
    }
  }

  const fileHash = calculateFileSha256(content);

  return {
    header,
    punchRecords,
    otherRecordsCount,
    warnings,
    errors,
    fileHash,
  };
}
