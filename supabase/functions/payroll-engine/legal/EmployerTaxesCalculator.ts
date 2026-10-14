import { round2, sumMoney } from '../utils/money.ts';

export interface LaborConfig {
  inss_patronal_percentage?: number; // default 20%
  rat_percentage?: number;           // default 2%
  fap_multiplier?: number;           // default 1.0
  terceiros_percentage?: number;     // default 5.8%
  tax_regime?: string;               // SIMPLES, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL
  simples_anexo?: string;            // 'I', 'II', 'III', 'IV', 'V'
  is_cprb_exempted?: boolean;        // true = Desoneração da Folha de Pagamento (CPRB Lei 12.546/2011)
}

export class EmployerTaxesCalculator {
  /**
   * Apura os encargos patronais da empresa considerando o regime tributário
   * (Simples Nacional vs Lucro Presumido/Real) e eventual opção pela desoneração da folha (CPRB).
   * 
   * Legislação:
   * - Lei Complementar nº 123/2006 (Simples Nacional - isenção para Anexos I, II, III e V; Anexo IV recolhe INSS/RAT)
   * - Lei nº 12.546/2011 (CPRB - isenção de cota patronal 20%, mantendo RAT e Terceiros)
   * - Lei nº 8.212/1991 (Art. 22 - Contribuição patronal geral de 20%, RAT com FAP e Terceiros/Outras Entidades)
   */
  public static calculate(
    baseInss: number,
    baseFgts: number,
    config?: LaborConfig
  ): {
    inss_patronal: number;
    rat_adjusted: number;
    terceiros: number;
    fgts_patronal: number;
    total: number;
    regimeApplied: string;
  } {
    const rawRegime = (config?.tax_regime || '').toUpperCase();
    const isSimples = rawRegime === 'SIMPLES' || rawRegime === 'SIMPLES_NACIONAL';
    const simplesAnexo = (config?.simples_anexo || '').toUpperCase();
    const isCprb = Boolean(config?.is_cprb_exempted);

    const inssPerc = config?.inss_patronal_percentage ?? 20;
    const ratPerc = config?.rat_percentage ?? 2;
    const fapMult = config?.fap_multiplier ?? 1.0;
    const terceirosPerc = config?.terceiros_percentage ?? 5.8;

    let inss_patronal = 0;
    let rat_adjusted = 0;
    let terceiros = 0;
    let regimeApplied = 'REGIME_GERAL';

    if (isSimples) {
      if (simplesAnexo === 'IV') {
        // Anexo IV do Simples recolhe cota patronal de 20% e RAT, porém é isento de Terceiros (Outras Entidades)
        regimeApplied = 'SIMPLES_NACIONAL_ANEXO_IV';
        inss_patronal = round2(baseInss * (inssPerc / 100));
        rat_adjusted = round2(baseInss * ((ratPerc * fapMult) / 100));
        terceiros = 0;
      } else {
        // Demais Anexos do Simples (I, II, III, V) são isentos de patronal de 20%, RAT e Terceiros (já inclusos no DAS)
        regimeApplied = `SIMPLES_NACIONAL_${simplesAnexo || 'ISENTO'}`;
        inss_patronal = 0;
        rat_adjusted = 0;
        terceiros = 0;
      }
    } else if (isCprb) {
      // Empresa desonerada (CPRB): cota patronal de 20% substituída pela receita bruta, mantendo RAT e Terceiros
      regimeApplied = 'CPRB_DESONERADO';
      inss_patronal = 0;
      rat_adjusted = round2(baseInss * ((ratPerc * fapMult) / 100));
      terceiros = round2(baseInss * (terceirosPerc / 100));
    } else {
      // Regime Geral (Lucro Presumido / Lucro Real): recolhimento integral
      regimeApplied = 'REGIME_GERAL';
      inss_patronal = round2(baseInss * (inssPerc / 100));
      rat_adjusted = round2(baseInss * ((ratPerc * fapMult) / 100));
      terceiros = round2(baseInss * (terceirosPerc / 100));
    }

    const fgts_patronal = round2(baseFgts * 0.08);
    const total = sumMoney([inss_patronal, rat_adjusted, terceiros, fgts_patronal]);

    return {
      inss_patronal,
      rat_adjusted,
      terceiros,
      fgts_patronal,
      total,
      regimeApplied,
    };
  }
}
