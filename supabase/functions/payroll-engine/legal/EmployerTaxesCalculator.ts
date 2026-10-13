import { round2, sumMoney } from '../utils/money.ts';

export interface LaborConfig {
  inss_patronal_percentage?: number; // default 20
  rat_percentage?: number;           // default 2
  fap_multiplier?: number;           // default 1
  terceiros_percentage?: number;     // default 5.8
}

export class EmployerTaxesCalculator {
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
  } {
    const inssPerc = config?.inss_patronal_percentage ?? 20;
    const ratPerc = config?.rat_percentage ?? 2;
    const fapMult = config?.fap_multiplier ?? 1.0;
    const terceirosPerc = config?.terceiros_percentage ?? 5.8;

    const inss_patronal = round2(baseInss * (inssPerc / 100));
    const rat_adjusted = round2(baseInss * ((ratPerc * fapMult) / 100));
    const terceiros = round2(baseInss * (terceirosPerc / 100));
    const fgts_patronal = round2(baseFgts * 0.08);

    const total = sumMoney([inss_patronal, rat_adjusted, terceiros, fgts_patronal]);

    return {
      inss_patronal,
      rat_adjusted,
      terceiros,
      fgts_patronal,
      total,
    };
  }
}
