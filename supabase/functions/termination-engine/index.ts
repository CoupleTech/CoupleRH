import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { INSSCalculator } from "../payroll-engine/legal/INSSCalculator.ts";
import { IRRFCalculator } from "../payroll-engine/legal/IRRFCalculator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function diffDays(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      contract_id,
      mediasAdicionais = 0, 
      outrosDescontos = 0,
      noticeDate, 
      terminationDate, 
      noticeType, 
      reason,
      tenant_id
    } = body;

    if (!contract_id || !terminationDate || !tenant_id) {
      throw new Error("contract_id, terminationDate, and tenant_id are required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase Environment Variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch Contract
    const { data: contract, error: contractError } = await supabase
      .from('employment_contracts')
      .select('base_salary, admission_date, status, workers(people(full_name))')
      .eq('id', contract_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (contractError || !contract) throw new Error("Contract not found");

    // 2. Fetch Legal Parameters for the termination year
    const termDateObj = parseDateUTC(terminationDate);
    const periodStartDate = new Date(termDateObj.getUTCFullYear(), termDateObj.getUTCMonth(), 1).toISOString().split('T')[0];

    const { data: legalVersions } = await supabase
      .from('legal_versions')
      .select('id, version_name')
      .lte('valid_from', periodStartDate)
      .order('valid_from', { ascending: false });

    let inss_parameters = [];
    let irrf_parameters = [];
    let general_legal_parameters = {};

    if (legalVersions && legalVersions.length > 0) {
      const { data: lv2 } = await supabase
        .from('legal_versions')
        .select('id')
        .lte('valid_from', periodStartDate)
        .or(`valid_to.gte.${periodStartDate},valid_to.is.null`)
        .order('valid_from', { ascending: false })
        .limit(1);

      const activeVersionId = (lv2 && lv2.length > 0) ? lv2[0].id : legalVersions[0].id;

      const { data: inssData } = await supabase.from('inss_parameters').select('*').eq('version_id', activeVersionId).order('bracket_number');
      const { data: irrfData } = await supabase.from('irrf_parameters').select('*').eq('version_id', activeVersionId).order('bracket_number');
      const { data: generalData } = await supabase.from('general_legal_parameters').select('*').eq('version_id', activeVersionId).limit(1);

      inss_parameters = inssData || [];
      irrf_parameters = irrfData || [];
      general_legal_parameters = (generalData && generalData.length > 0) ? generalData[0] : {};
    }

    // 3. Calculation Logic (ported from trctEngine.ts, but using INSSCalculator and IRRFCalculator)
    const baseSalary = contract.base_salary;
    const admissionDate = contract.admission_date;
    
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
        direitoAviso = false;
        descontaAvisoNaoCumprido = true;
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
        multiplicadorAvisoIndenizado = 0.5;
        percentualMultaFGTS = 0.20;
        break;
    }

    // 1. Saldo de Salário
    let daysInTerminationMonth = termDate.getUTCDate();
    if (admDate.getUTCMonth() === termDate.getUTCMonth() && admDate.getUTCFullYear() === termDate.getUTCFullYear()) {
      daysInTerminationMonth = diffDays(admDate, termDate);
    }
    const saldoSalarioValor = (remuneracaoBase / 30) * daysInTerminationMonth;

    // 2. Aviso Prévio
    let diasAvisoTotal = 0;
    let avisoIndenizadoValor = 0;
    let avisoDescontadoValor = 0;
    
    const anosCompletos = Math.floor(diffDays(admDate, termDate) / 365);
    diasAvisoTotal = 30 + (anosCompletos * 3);
    if (diasAvisoTotal > 90) diasAvisoTotal = 90;

    if (noticeType === 'indemnified') {
      if (direitoAviso) {
        avisoIndenizadoValor = (remuneracaoBase / 30) * diasAvisoTotal * multiplicadorAvisoIndenizado;
      } else if (descontaAvisoNaoCumprido) {
        avisoDescontadoValor = (remuneracaoBase / 30) * 30;
      }
    } else if (noticeType === 'waived') {
      diasAvisoTotal = 0;
    } else if (noticeType === 'worked' || noticeType === 'mixed') {
      diasAvisoTotal = 0;
    }

    // 3. Projeção do Aviso
    const projectedDate = new Date(termDate.getTime());
    if (diasAvisoTotal > 0 && direitoAviso && noticeType === 'indemnified') {
      projectedDate.setUTCDate(projectedDate.getUTCDate() + diasAvisoTotal);
    }

    // 4. 13º Salário
    let decimoAvos = 0;
    let decimoAvisoAvos = 0;
    
    if (direitoDecimoProporcional) {
      const startOfYear = new Date(Date.UTC(termDate.getUTCFullYear(), 0, 1));
      const calcStartDecimo = admDate > startOfYear ? admDate : startOfYear;
      
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

      if (projectedDate.getTime() > termDate.getTime()) {
        if (projectedDate.getUTCMonth() > termDate.getUTCMonth()) {
          if (projectedDate.getUTCDate() >= 15) {
             decimoAvisoAvos = 1;
          }
        }
      }
    }
    const decimoValor = (remuneracaoBase / 12) * decimoAvos;
    const decimoAvisoValor = (remuneracaoBase / 12) * decimoAvisoAvos;

    // 5. Férias Proporcionais
    let feriasAvos = 0;
    if (direitoFeriasProporcionais) {
      let diffTime = projectedDate.getTime() - admDate.getTime();
      let diffDaysTotal = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      feriasAvos = Math.floor(diffDaysTotal / 30);
      let leftoverDays = diffDaysTotal % 30;
      if (leftoverDays >= 15) feriasAvos++;
      if (feriasAvos > 12) feriasAvos = feriasAvos % 12;
    }
    const feriasValor = (remuneracaoBase / 12) * feriasAvos;
    const umTercoFeriasValor = feriasValor / 3;

    // 6. Descontos de Impostos (USING BACKEND CALCULATORS)
    const inssSaldoResult = INSSCalculator.calculate(saldoSalarioValor, inss_parameters);
    const inssDecimoResult = INSSCalculator.calculate(decimoValor, inss_parameters);
    const inssSaldoValor = inssSaldoResult.value;
    const inssDecimoValor = inssDecimoResult.value;
    
    // IRRF
    const dependents = 0; // Simplified for TRCT MVP, could fetch from dependents table like payroll-engine
    const irrfBase = saldoSalarioValor - inssSaldoValor;
    const irrfResult = IRRFCalculator.calculate(irrfBase, inssSaldoValor, dependents, irrf_parameters, general_legal_parameters);
    const irrfValor = irrfResult.value;

    // 7. Encargos (FGTS)
    const fgtsMes = saldoSalarioValor * 0.08;
    const fgtsAviso = avisoIndenizadoValor * 0.08;
    const fgtsDecimo = (decimoValor + decimoAvisoValor) * 0.08;
    const baseMulta = (remuneracaoBase * 0.08 * (diffDays(admDate, termDate) / 30)) + fgtsMes + fgtsAviso + fgtsDecimo; 
    const multaFGTS = baseMulta * percentualMultaFGTS;

    // 8. Fechamento
    const proventosTotal = saldoSalarioValor + avisoIndenizadoValor + decimoValor + decimoAvisoValor + feriasValor + umTercoFeriasValor;
    const descontosTotal = inssSaldoValor + inssDecimoValor + irrfValor + avisoDescontadoValor + outrosDescontos;
    const liquido = proventosTotal - descontosTotal;

    const trctResult = {
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
        avisoDescontado: { dias: descontaAvisoNaoCumprido && noticeType === 'indemnified' ? 30 : 0, valor: avisoDescontadoValor },
        outros: { valor: outrosDescontos }
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

    return new Response(JSON.stringify(trctResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
