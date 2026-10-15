/**
 * signatureCanvasCore.ts
 * 
 * Lógica matemática e vetorial pura para validação e processamento de rubricas digitais
 * Tarefa: AS-03 (Fase P6)
 */

import type { SignatureStrokePoint } from './documentSignatureModel';

export interface StrokeValidationResult {
  valid: boolean;
  reason?: string;
  strokeCount: number;
  pointCount: number;
  totalLength: number;
}

export class SignatureCanvasCore {
  /**
   * Limiar mínimo de pontos e distância euclidiana para considerar uma rubrica válida
   */
  public static readonly MIN_POINTS = 12;
  public static readonly MIN_DISTANCE_PX = 35;

  /**
   * Valida se os traços do canvas formam uma rubrica autêntica e não um clique acidental
   */
  public static validateStrokes(strokes: SignatureStrokePoint[][]): StrokeValidationResult {
    if (!strokes || strokes.length === 0) {
      return {
        valid: false,
        reason: 'Nenhum traço foi desenhado.',
        strokeCount: 0,
        pointCount: 0,
        totalLength: 0
      };
    }

    let pointCount = 0;
    let totalLength = 0;

    for (const stroke of strokes) {
      if (!stroke || stroke.length === 0) continue;
      pointCount += stroke.length;

      for (let i = 1; i < stroke.length; i++) {
        const prev = stroke[i - 1];
        const curr = stroke[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    }

    if (pointCount < this.MIN_POINTS) {
      return {
        valid: false,
        reason: 'Rubrica muito curta. Desenhe sua assinatura de forma completa.',
        strokeCount: strokes.length,
        pointCount,
        totalLength: Math.round(totalLength)
      };
    }

    if (totalLength < this.MIN_DISTANCE_PX) {
      return {
        valid: false,
        reason: 'Traçado insuficiente. Por favor, assine com maior clareza.',
        strokeCount: strokes.length,
        pointCount,
        totalLength: Math.round(totalLength)
      };
    }

    return {
      valid: true,
      strokeCount: strokes.length,
      pointCount,
      totalLength: Math.round(totalLength)
    };
  }

  /**
   * Converte traços vetoriais em um elemento SVG escalável puro
   */
  public static strokesToSvg(strokes: SignatureStrokePoint[][], width: number = 400, height: number = 180): string {
    let pathData = '';

    for (const stroke of strokes) {
      if (!stroke || stroke.length === 0) continue;
      pathData += `M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)} `;
      for (let i = 1; i < stroke.length; i++) {
        pathData += `L ${stroke[i].x.toFixed(1)} ${stroke[i].y.toFixed(1)} `;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <path d="${pathData.trim()}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
  }

  /**
   * Converte vetor de traços para Data URL de SVG para fallback caso canvas toDataURL falhe
   */
  public static strokesToSvgDataUrl(strokes: SignatureStrokePoint[][], width: number = 400, height: number = 180): string {
    const svg = this.strokesToSvg(strokes, width, height);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}
