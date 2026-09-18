export class FGTSCalculator {
  public static calculate(base: number, isApprentice: boolean = false): { value: number, rate: number } {
    const rate = isApprentice ? 2.0 : 8.0;
    return {
      value: Math.round(base * (rate / 100) * 100) / 100,
      rate
    };
  }
}
