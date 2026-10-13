/**
 * Utilitário de Precisão Monetária e Arredondamento Contábil - coupleRH (T21)
 * 
 * Regra:
 * - Política única HALF_UP (comercial/bancária brasileira).
 * - 2 casas decimais por rubrica, base e imposto.
 * - Operações baseadas em centavos inteiros para eliminar anomalias IEEE 754 de ponto flutuante.
 */

/**
 * Arredonda um valor numérico para 2 casas decimais usando a política HALF_UP.
 * Valores com fração decimal >= 0.005 são arredondados afastando-se do zero (ex: 1.005 -> 1.01; -1.005 -> -1.01).
 * Usa conversão por notação exponencial para tratar anomalias de representação binária float.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const rounded = Math.round(Number(`${abs}e+2`));
  return sign * Number(`${rounded}e-2`);
}

/**
 * Converte valor em reais para centavos inteiros (número inteiro).
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  return sign * Math.round(Number(`${abs}e+2`));
}

/**
 * Converte centavos inteiros para reais (número com 2 casas decimais).
 */
export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  const sign = cents < 0 ? -1 : 1;
  const abs = Math.round(Math.abs(cents));
  return sign * Number(`${abs}e-2`);
}

/**
 * Adiciona dois valores monetários operando estritamente em centavos inteiros.
 */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Subtrai dois valores monetários operando estritamente em centavos inteiros.
 */
export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiplica um valor monetário por um fator (ex: alíquota, horas, dias), arredondando com HALF_UP.
 */
export function multiplyMoney(amount: number, factor: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(factor)) return 0;
  return round2(amount * factor);
}

/**
 * Divide um valor monetário por um divisor (ex: 30 dias, divisor de horas), arredondando com HALF_UP.
 */
export function divideMoney(amount: number, divisor: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(divisor) || divisor === 0) return 0;
  return round2(amount / divisor);
}

/**
 * Soma um array de valores monetários operando estritamente em centavos inteiros.
 * Garante que a soma contábil de itens não acumule erros infinitesimais de float.
 */
export function sumMoney(amounts: number[]): number {
  const totalCents = amounts.reduce((acc, curr) => acc + toCents(curr), 0);
  return fromCents(totalCents);
}

/**
 * Verifica se dois valores monetários são idênticos em centavos.
 */
export function moneyEquals(a: number, b: number): boolean {
  return toCents(a) === toCents(b);
}

/**
 * Formata um valor monetário para formato brasileiro BRL (ex: "R$ 1.234,56").
 */
export function formatBRL(amount: number): string {
  const rounded = round2(amount);
  return rounded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
