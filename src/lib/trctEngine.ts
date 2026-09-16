/**
 * TRCT Engine - Motor de Cálculo de Rescisão Trabalhista
 * Baseado nas regras da CLT, Reforma Trabalhista (Lei 13.467/2017) e eSocial.
 */

const INSS_BRACKETS_2026 = [
  { limit: 1621.00, rate: 0.075, deduction: 0 },
  { limit: 2715.35, rate: 0.09, deduction: 24.315 },
  { limit: 4072.06, rate: 0.12, deduction: 105.775 },
  { limit: 8094.02, rate: 0.14, deduction: 187.216 }
];

export interface TRCTParams {
  baseSalary: number;
  mediasAdicionais?: number; // Representa a soma de médias de horas extras, comissões, etc.
  admissionDate: string; // YYYY-MM-DD
  noticeDate: string; // YYYY-MM-DD
  terminationDate: string; // YYYY-MM-DD
  noticeType: 'worked' | 'indemnified' | 'waived' | 'mixed';
  reason: string; 
  // 1: Sem justa causa
  // 2: Pedido de demissão
  // 3: Justa causa
  // 4: Término contrato determinado
  // 5: Acordo (Art 484-A)
}

export interface TRCTResult {
  proventos: {
    saldoSalario: { dias: number; valor: number };
    avisoIndenizado: { dias: number; valor: number };
    decimoTerceiro: { avos: number; valor: number };
    decimoTerceiroAviso: { avos: number; valor: number };
    feriasProporcionais: { avos: number; valor: number };
    umTercoFerias: { valor: number };
  };
  descontos: {
    inssSaldo: { valor: number };
    inssDecimo: { valor: number };
    irrf: { valor: number };
    avisoDescontado: { dias: number; valor: number };
  };
  encargos: {
    fgtsMes: number;
    fgtsAviso: number;
    fgtsDecimo: number;
    baseMulta: number; // base simulada
    percentualMulta: number;
    multaFGTS: number;
  };
  totais: {
    bruto: number;
    descontos: number;
    liquido: number;
  };
  metadados: {
    diasAvisoReal: number;
    dataProjetada: string;
    remuneracaoBase: number;
  };
}

export function calculateINSS(base: number): number {
  if (base <= 0) return 0;
  
  let totalINSS = 0;
  let remainingBase = base;
  let previousLimit = 0;

  for (const bracket of INSS_BRACKETS_2026) {
    const range = bracket.limit - previousLimit;
    const taxableInThisRange = Math.min(remainingBase, range);
    
    if (taxableInThisRange > 0) {
      totalINSS += taxableInThisRange * bracket.rate;
      remainingBase -= taxableInThisRange;
    }
    previousLimit = bracket.limit;
    
    if (remainingBase <= 0) break;
  }
  
  // Teto
  if (remainingBase > 0) {
    // limit is reached, it doesn't charge above ceiling in standard CLT
  }

  return Number(totalINSS.toFixed(2));
}

function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function diffDays(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function generateTRCT(params: TRCTParams): TRCTResult {
  const { baseSalary, mediasAdicionais = 0, admissionDate, terminationDate, noticeType, reason } = params;
  
  const remuneracaoBase = baseSalary + mediasAdicionais;
  const admDate = parseDateUTC(admissionDate);
  const termDate = parseDateUTC(terminationDate);
  
  // --- REGRAS POR MOTIVO ---
  let direitoAviso = false;
  let descontaAvisoNaoCumprido = false;
  let direitoFeriasProporcionais = true;
  let direitoDecimoProporcional = true;
  let percentualMultaFGTS = 0;
  let multiplicadorAvisoIndenizado = 1;

  switch (reason) {
    case '1': // Sem justa causa
      direitoAviso = true;
      percentualMultaFGTS = 0.40;
      break;
    case '2': // Pedido de demissão
      direitoAviso = false; // Empregador não paga aviso indenizado
      descontaAvisoNaoCumprido = true; // Pode ser descontado se não trabalhado
      percentualMultaFGTS = 0;
      break;
    case '3': // Justa causa
      direitoAviso = false;
      direitoFeriasProporcionais = false;
      direitoDecimoProporcional = false;
      percentualMultaFGTS = 0;
      break;
    case '4': // Término de contrato a termo
      direitoAviso = false;
      percentualMultaFGTS = 0;
      break;
    case '5': // Acordo
      direitoAviso = true;
      multiplicadorAvisoIndenizado = 0.5; // Metade do aviso
      percentualMultaFGTS = 0.20;
      break;
  }

  // --- 1. Saldo de Salário ---
  let daysInTerminationMonth = termDate.getUTCDate();
  if (admDate.getUTCMonth() === termDate.getUTCMonth() && admDate.getUTCFullYear() === termDate.getUTCFullYear()) {
    daysInTerminationMonth = diffDays(admDate, termDate);
  }
  const saldoSalarioValor = (remuneracaoBase / 30) * daysInTerminationMonth;

  // --- 2. Aviso Prévio ---
  let diasAvisoTotal = 0;
  let avisoIndenizadoValor = 0;
  let avisoDescontadoValor = 0;
  
  // Calcula dias proporcionais
  const anosCompletos = Math.floor(diffDays(admDate, termDate) / 365);
  diasAvisoTotal = 30 + (anosCompletos * 3);
  if (diasAvisoTotal > 90) diasAvisoTotal = 90;

  if (noticeType === 'indemnified') {
    if (direitoAviso) {
      avisoIndenizadoValor = (remuneracaoBase / 30) * diasAvisoTotal * multiplicadorAvisoIndenizado;
    } else if (descontaAvisoNaoCumprido) {
      avisoDescontadoValor = (remuneracaoBase / 30) * 30; // Limitado a 30 dias na demissão
    }
  } else if (noticeType === 'waived') {
    diasAvisoTotal = 0; // Se dispensado, não projeta
  } else if (noticeType === 'worked' || noticeType === 'mixed') {
    // Trabalhado ou misto não entra como verba indenizada total, saldo de salário já paga os dias efetivamente trabalhados.
    diasAvisoTotal = 0; // Projeção para avos ocorre só no indenizado, o trabalhado já extende a termDate nativamente.
  }

  // --- 3. Projeção do Aviso ---
  const projectedDate = new Date(termDate.getTime());
  if (diasAvisoTotal > 0 && direitoAviso && noticeType === 'indemnified') {
    projectedDate.setUTCDate(projectedDate.getUTCDate() + diasAvisoTotal);
  }

  // --- 4. 13º Salário ---
  let decimoAvos = 0;
  let decimoAvisoAvos = 0;
  let decimoValor = 0;
  let decimoAvisoValor = 0;

  if (direitoDecimoProporcional) {
    const startOfYear = new Date(Date.UTC(termDate.getUTCFullYear(), 0, 1));
    const calcStartDecimo = admDate > startOfYear ? admDate : startOfYear;
    
    // Até a data efetiva
    for (let m = calcStartDecimo.getUTCMonth(); m <= termDate.getUTCMonth(); m++) {
      let daysInM = 30;
      if (m === calcStartDecimo.getUTCMonth() && m === termDate.getUTCMonth()) {
         daysInM = diffDays(calcStartDecimo, termDate);
      } else if (m === calcStartDecimo.getUTCMonth()) {
         const lastDay = new Date(Date.UTC(calcStartDecimo.getUTCFullYear(), m + 1, 0));
         daysInM = diffDays(calcStartDecimo, lastDay);
      } else if (m === termDate.getUTCMonth()) {
         daysInM = termDate.getUTCDate();
      }
      if (daysInM >= 15) decimoAvos++;
    }

    // Projeção indenizada
    if (projectedDate.getTime() > termDate.getTime()) {
      if (projectedDate.getUTCMonth() > termDate.getUTCMonth()) {
        if (projectedDate.getUTCDate() >= 15) {
           decimoAvisoAvos = 1;
        }
      }
    }
    
    decimoValor = (remuneracaoBase / 12) * decimoAvos;
    decimoAvisoValor = (remuneracaoBase / 12) * decimoAvisoAvos;
  }

  // --- 5. Férias Proporcionais ---
  let feriasAvos = 0;
  let feriasValor = 0;
  let umTercoFeriasValor = 0;

  if (direitoFeriasProporcionais) {
    let diffTime = projectedDate.getTime() - admDate.getTime();
    let diffDaysTotal = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    feriasAvos = Math.floor(diffDaysTotal / 30);
    let leftoverDays = diffDaysTotal % 30;
    if (leftoverDays >= 15) feriasAvos++;
    if (feriasAvos > 12) feriasAvos = feriasAvos % 12; // Apenas o saldo que não venceu
    
    feriasValor = (remuneracaoBase / 12) * feriasAvos;
    umTercoFeriasValor = feriasValor / 3;
  }

  // --- 6. Descontos de Impostos ---
  const inssSaldoValor = calculateINSS(saldoSalarioValor);
  const inssDecimoValor = calculateINSS(decimoValor); // Não incide sobre aviso indenizado
  
  // IRRF simplificado
  const irrfBase = saldoSalarioValor - inssSaldoValor;
  let irrfValor = 0;
  if (irrfBase > 2428.80) { 
    irrfValor = (irrfBase * 0.075) - 169.44; 
    if (irrfValor < 0) irrfValor = 0;
  }

  // --- 7. Encargos (FGTS) ---
  const fgtsMes = saldoSalarioValor * 0.08;
  const fgtsAviso = avisoIndenizadoValor * 0.08;
  const fgtsDecimo = (decimoValor + decimoAvisoValor) * 0.08;
  // Simulação de base de multa. Num sistema real, somaríamos todo histórico recolhido.
  const baseMulta = (remuneracaoBase * 0.08 * (diffDays(admDate, termDate) / 30)) + fgtsMes + fgtsAviso + fgtsDecimo; 
  const multaFGTS = baseMulta * percentualMultaFGTS;

  // --- 8. Fechamento ---
  const proventosTotal = saldoSalarioValor + avisoIndenizadoValor + decimoValor + decimoAvisoValor + feriasValor + umTercoFeriasValor;
  const descontosTotal = inssSaldoValor + inssDecimoValor + irrfValor + avisoDescontadoValor;
  const liquido = proventosTotal - descontosTotal;

  return {
    proventos: {
      saldoSalario: { dias: daysInTerminationMonth, valor: saldoSalarioValor },
      avisoIndenizado: { dias: direitoAviso && noticeType === 'indemnified' ? diasAvisoTotal : 0, valor: avisoIndenizadoValor },
      decimoTerceiro: { avos: decimoAvos, valor: decimoValor },
      decimoTerceiroAviso: { avos: decimoAvisoAvos, valor: decimoAvisoValor },
      feriasProporcionais: { avos: feriasAvos, valor: feriasValor },
      umTercoFerias: { valor: umTercoFeriasValor }
    },
    descontos: {
      inssSaldo: { valor: inssSaldoValor },
      inssDecimo: { valor: inssDecimoValor },
      irrf: { valor: irrfValor },
      avisoDescontado: { dias: descontaAvisoNaoCumprido && noticeType === 'indemnified' ? 30 : 0, valor: avisoDescontadoValor }
    },
    encargos: {
      fgtsMes,
      fgtsAviso,
      fgtsDecimo,
      baseMulta,
      percentualMulta: percentualMultaFGTS,
      multaFGTS
    },
    totais: {
      bruto: proventosTotal,
      descontos: descontosTotal,
      liquido: liquido
    },
    metadados: {
      diasAvisoReal: diasAvisoTotal,
      dataProjetada: projectedDate.toISOString().split('T')[0],
      remuneracaoBase
    }
  };
}
