import { round2 } from '../utils/money.ts';

export class FGTSCalculator {
  public static calculate(base: number, isApprentice: boolean = false): { value: number, rate: number } {
    const rate = isApprentice ? 2.0 : 8.0;
    return {
      value: round2(base * (rate / 100)),
      rate
    };
  }
}
