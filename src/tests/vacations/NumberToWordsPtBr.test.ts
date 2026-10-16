import { describe, it, expect } from 'vitest';
import { numberToWordsPtBr } from '../../utils/numberToWordsPtBr';

describe('numberToWordsPtBr - Conversão de Valores Monetários em Reais por Extenso', () => {
  it('deve converter zero reais', () => {
    expect(numberToWordsPtBr(0)).toBe('Zero reais');
  });

  it('deve converter um real singular', () => {
    expect(numberToWordsPtBr(1)).toBe('Um real');
  });

  it('deve converter apenas centavos no singular e plural', () => {
    expect(numberToWordsPtBr(0.01)).toBe('Um centavo');
    expect(numberToWordsPtBr(0.50)).toBe('Cinquenta centavos');
    expect(numberToWordsPtBr(0.99)).toBe('Noventa e nove centavos');
  });

  it('deve converter valores com reais e centavos', () => {
    expect(numberToWordsPtBr(1.01)).toBe('Um real e um centavo');
    expect(numberToWordsPtBr(1.50)).toBe('Um real e cinquenta centavos');
    expect(numberToWordsPtBr(2.25)).toBe('Dois reais e vinte e cinco centavos');
  });

  it('deve converter centenas e dezenas redondas e compostas', () => {
    expect(numberToWordsPtBr(100)).toBe('Cem reais');
    expect(numberToWordsPtBr(105)).toBe('Cento e cinco reais');
    expect(numberToWordsPtBr(234.56)).toBe('Duzentos e trinta e quatro reais e cinquenta e seis centavos');
  });

  it('deve converter milhares simples e compostos', () => {
    expect(numberToWordsPtBr(1000)).toBe('Um mil reais');
    expect(numberToWordsPtBr(1450.75)).toBe('Um mil, quatrocentos e cinquenta reais e setenta e cinco centavos');
    expect(numberToWordsPtBr(3200)).toBe('Três mil e duzentos reais');
    expect(numberToWordsPtBr(5432.10)).toBe('Cinco mil, quatrocentos e trinta e dois reais e dez centavos');
  });

  it('deve converter dezenas de milhar com precisão', () => {
    expect(numberToWordsPtBr(12500)).toBe('Doze mil e quinhentos reais');
    expect(numberToWordsPtBr(25400.90)).toBe('Vinte e cinco mil e quatrocentos reais e noventa centavos');
  });
});
