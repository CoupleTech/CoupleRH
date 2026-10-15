import { describe, it, expect } from 'vitest';
import { formatPunchToSaoPaulo } from '../../services/timeTracking/timeManagementService';

describe('Correção de Fuso Horário de Batidas de Ponto (America/Sao_Paulo - UTC-3)', () => {
  it('deve converter corretamente timestamp UTC de 18:04 para o horário de Brasília 15:04', () => {
    // 15:04 no Brasil = 18:04 em UTC (armazenado pelo servidor)
    const result = formatPunchToSaoPaulo('2026-10-15T18:04:00.000Z');
    expect(result.date).toBe('2026-10-15');
    expect(result.time).toBe('15:04');
    expect(result.hours).toBe(15);
    expect(result.minutes).toBe(4);
  });

  it('deve converter corretamente timestamp já com offset -03:00', () => {
    const result = formatPunchToSaoPaulo('2026-10-15T15:04:00-03:00');
    expect(result.date).toBe('2026-10-15');
    expect(result.time).toBe('15:04');
    expect(result.hours).toBe(15);
    expect(result.minutes).toBe(4);
  });

  it('deve manter a data correta no Brasil para batida noturna que vira o dia em UTC', () => {
    // 22:30 no Brasil em 15/10/2026 é 01:30 em UTC em 16/10/2026
    const result = formatPunchToSaoPaulo('2026-10-16T01:30:00.000Z');
    expect(result.date).toBe('2026-10-15');
    expect(result.time).toBe('22:30');
    expect(result.hours).toBe(22);
    expect(result.minutes).toBe(30);
  });

  it('deve tratar data inválida ou nula graciosamente sem estourar exceção', () => {
    const result = formatPunchToSaoPaulo('invalid-date');
    expect(result.time).toBe('00:00');
    expect(result.date).toBe('');
  });
});
