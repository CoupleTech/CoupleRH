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

    const inss_patronal = baseInss * (inssPerc / 100);
    const rat_adjusted = baseInss * ((ratPerc * fapMult) / 100);
    const terceiros = baseInss * (terceirosPerc / 100);
    const fgts_patronal = baseFgts * 0.08;

    const total = inss_patronal + rat_adjusted + terceiros + fgts_patronal;

    return {
      inss_patronal: Math.round(inss_patronal * 100) / 100,
      rat_adjusted: Math.round(rat_adjusted * 100) / 100,
      terceiros: Math.round(terceiros * 100) / 100,
      fgts_patronal: Math.round(fgts_patronal * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
}
