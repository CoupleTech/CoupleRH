import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeBankService } from '../../services/timeTracking/timeBankService';

describe('TB-04.3: Regra de Teto Mensal de Acúmulo no Banco de Horas com Transbordo para a Folha', () => {
  it('1. Deve creditar 100% das horas no banco quando não houver teto mensal configurado (ilimitado)', () => {
    const result = TimeBankService.calculateMonthlyCapOverflow({
      overtime50Minutes: 600, // 10h
      overtime100Minutes: 300, // 5h
      monthlyCapHours: null
    });

    expect(result.hasCap).toBe(false);
    expect(result.bankMinutes).toBe(900); // 15h
    expect(result.overflowMinutes).toBe(0);
    expect(result.overflow50Hours).toBe(0);
    expect(result.overflow100Hours).toBe(0);
  });

  it('2. Deve creditar integralmente no banco se o total de horas extras for menor ou igual ao teto mensal', () => {
    // 12h totais apuradas, teto configurado de 20h
    const result = TimeBankService.calculateMonthlyCapOverflow({
      overtime50Minutes: 480, // 8h
      overtime100Minutes: 240, // 4h
      monthlyCapHours: 20
    });

    expect(result.hasCap).toBe(true);
    expect(result.capMinutes).toBe(1200); // 20h * 60
    expect(result.bankMinutes).toBe(720); // 12h
    expect(result.overflowMinutes).toBe(0);
    expect(result.overflow50Hours).toBe(0);
    expect(result.overflow100Hours).toBe(0);
    expect(result.bankCredited50Minutes).toBe(480);
    expect(result.bankCredited100Minutes).toBe(240);
  });

  it('3. Deve limitar o crédito no banco ao teto e transbordar o excesso de HE 50% para a folha', () => {
    // 25h de HE 50% (1500 min), teto de 20h (1200 min) -> 5h (300 min) transbordam
    const result = TimeBankService.calculateMonthlyCapOverflow({
      overtime50Minutes: 1500, // 25h
      overtime100Minutes: 0,
      monthlyCapHours: 20
    });

    expect(result.hasCap).toBe(true);
    expect(result.capMinutes).toBe(1200);
    expect(result.bankMinutes).toBe(1200); // 20h
    expect(result.overflowMinutes).toBe(300); // 5h
    expect(result.overflow50Hours).toBe(5);
    expect(result.overflow100Hours).toBe(0);
    expect(result.bankCredited50Minutes).toBe(1200);
  });

  it('4. Deve alocar horas mistas (50% e 100%) respeitando o teto e transbordando o saldo residual de maior adicional', () => {
    // 15h de HE 50% (900 min) + 10h de HE 100% (600 min) = 25h totais (1500 min)
    // Teto de 20h (1200 min)
    // O banco absorve 15h de 50% + 5h de 100% = 20h (1200 min)
    // Transbordam para a folha 5h de HE 100% (300 min)
    const result = TimeBankService.calculateMonthlyCapOverflow({
      overtime50Minutes: 900,
      overtime100Minutes: 600,
      monthlyCapHours: 20
    });

    expect(result.hasCap).toBe(true);
    expect(result.bankMinutes).toBe(1200);
    expect(result.overflowMinutes).toBe(300);
    expect(result.bankCredited50Minutes).toBe(900); // 15h
    expect(result.bankCredited100Minutes).toBe(300); // 5h
    expect(result.overflow50Hours).toBe(0);
    expect(result.overflow100Hours).toBe(5); // 5h de 100% transbordam para dinheiro
  });

  it('5. No regime HÍBRIDO, deve aplicar o teto sobre as HE 50% e transbordar o excesso para a folha', () => {
    // No regime híbrido, o banco recebe apenas HE 50% (HE 100% já é naturalmente remunerado em folha)
    // 14h de HE 50% (840 min), teto de 10h (600 min)
    // Banco recebe 10h (600 min), e 4h de HE 50% transbordam para folha
    const result = TimeBankService.calculateMonthlyCapOverflow({
      overtime50Minutes: 840,
      overtime100Minutes: 240, // 4h de 100%
      monthlyCapHours: 10,
      isHybrid: true
    });

    expect(result.hasCap).toBe(true);
    expect(result.bankMinutes).toBe(600); // 10h
    expect(result.overflowMinutes).toBe(240); // 4h
    expect(result.overflow50Hours).toBe(4);
    expect(result.overflow100Hours).toBe(0); // 100% não é transbordo do banco, pois já segue fluxo normal de folha
  });
});
