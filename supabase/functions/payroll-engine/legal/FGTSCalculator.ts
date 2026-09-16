export class FGTSCalculator {
  public static calculate(base: number): { value: number, rate: number } {
    return {
      value: Math.round(base * 0.08 * 100) / 100,
      rate: 8.0
    };
  }
}
