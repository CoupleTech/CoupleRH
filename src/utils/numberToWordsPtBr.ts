/**
 * numberToWordsPtBr.ts
 * 
 * Converte valores monetários numéricos (BRL) para sua representação textual por extenso em Português do Brasil.
 * Utilizado para demonstrativos de pagamento, recibos de férias (TB-06) e documentos legais CLT.
 */

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

/**
 * Converte um número inteiro de 0 a 999 para texto em português
 */
function trioParaTexto(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'cem';

  const c = Math.floor(num / 100);
  const restoC = num % 100;
  const partes: string[] = [];

  if (c > 0) {
    partes.push(CENTENAS[c]);
  }

  if (restoC > 0) {
    if (restoC < 20) {
      partes.push(UNIDADES[restoC]);
    } else {
      const d = Math.floor(restoC / 10);
      const u = restoC % 10;
      let dezenaStr = DEZENAS[d];
      if (u > 0) {
        dezenaStr += ` e ${UNIDADES[u]}`;
      }
      partes.push(dezenaStr);
    }
  }

  return partes.join(' e ');
}

/**
 * Converte um valor numérico inteiro (em reais) para texto
 */
function valorInteiroParaTexto(inteiro: number): string {
  if (inteiro === 0) return '';

  const milhoes = Math.floor(inteiro / 1_000_000);
  const restoMilhoes = inteiro % 1_000_000;
  const milhares = Math.floor(restoMilhoes / 1_000);
  const unidades = restoMilhoes % 1_000;

  const blocos: string[] = [];

  if (milhoes > 0) {
    const textoMilhoes = trioParaTexto(milhoes);
    blocos.push(`${textoMilhoes} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  }

  if (milhares > 0) {
    const textoMilhares = trioParaTexto(milhares);
    blocos.push(`${textoMilhares} mil`);
  }

  if (unidades > 0) {
    const textoUnidades = trioParaTexto(unidades);
    blocos.push(textoUnidades);
  }

  if (blocos.length === 1) {
    return blocos[0];
  }

  // Regra de pontuação entre milhares e unidades
  // Se unidades for <= 100 ou múltiplo de 100 (ex: 200, 300), usa "e", senão usa vírgula
  if (unidades > 0 && (unidades < 100 || unidades % 100 === 0)) {
    const ultimo = blocos.pop()!;
    return `${blocos.join(', ')} e ${ultimo}`;
  }

  return blocos.join(', ');
}

/**
 * Converte valor em reais (ex: 1540.25) para formato extenso formatado
 * Exemplo: 1540.25 -> "Um mil, quinhentos e quarenta reais e vinte e cinco centavos"
 */
export function numberToWordsPtBr(value: number): string {
  if (isNaN(value) || value < 0) {
    return 'Zero reais';
  }

  // Separa reais e centavos arredondando com precisão
  const arredondado = Math.round(value * 100) / 100;
  const reais = Math.floor(arredondado);
  const centavos = Math.round((arredondado - reais) * 100);

  if (reais === 0 && centavos === 0) {
    return 'Zero reais';
  }

  const partesResultado: string[] = [];

  if (reais > 0) {
    const textoReais = valorInteiroParaTexto(reais);
    const moeda = reais === 1 ? 'real' : 'reais';
    partesResultado.push(`${textoReais} ${moeda}`);
  }

  if (centavos > 0) {
    const textoCentavos = trioParaTexto(centavos);
    const moedaCentavo = centavos === 1 ? 'centavo' : 'centavos';
    partesResultado.push(`${textoCentavos} ${moedaCentavo}`);
  }

  const resultadoFinal = partesResultado.join(' e ');

  // Capitaliza a primeira letra
  return resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1);
}
