import { describe, it, expect } from 'vitest';
import { SignatureCanvasCore } from '../../services/documents/signatureCanvasCore';

describe('AS-03: Validação Vetorial de Rubrica Digital na Tela', () => {
  it('deve rejeitar lista de traços vazia', () => {
    const res = SignatureCanvasCore.validateStrokes([]);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Nenhum traço');
  });

  it('deve rejeitar rubricas com poucos pontos (ex: clique acidental na tela)', () => {
    const accidentalClick = [
      [{ x: 100, y: 100, time: 1000 }, { x: 101, y: 101, time: 1050 }]
    ];
    const res = SignatureCanvasCore.validateStrokes(accidentalClick);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Rubrica muito curta');
  });

  it('deve rejeitar movimentos concentrados no mesmo ponto sem deslocamento suficiente', () => {
    const jitter = [
      Array.from({ length: 15 }, (_, i) => ({ x: 100 + (i % 2), y: 100 + (i % 2), time: 1000 + i * 20 }))
    ];
    const res = SignatureCanvasCore.validateStrokes(jitter);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Traçado insuficiente');
  });

  it('deve aceitar uma rubrica autêntica com múltiplos pontos e comprimento adequado', () => {
    const validSignature = [
      // Traço 1: movimento curvilíneo
      Array.from({ length: 20 }, (_, i) => ({
        x: 50 + i * 5,
        y: 80 + Math.sin(i / 2) * 20,
        time: 1000 + i * 25
      })),
      // Traço 2: corte transversal
      [
        { x: 40, y: 90, time: 1600 },
        { x: 160, y: 85, time: 1750 }
      ]
    ];

    const res = SignatureCanvasCore.validateStrokes(validSignature);
    expect(res.valid).toBe(true);
    expect(res.strokeCount).toBe(2);
    expect(res.pointCount).toBe(22);
    expect(res.totalLength).toBeGreaterThan(100);
  });

  it('deve gerar SVG escalável válido a partir dos traços vetoriais', () => {
    const strokes = [
      [
        { x: 10, y: 20, time: 100 },
        { x: 30, y: 40, time: 200 },
        { x: 50, y: 60, time: 300 }
      ]
    ];

    const svg = SignatureCanvasCore.strokesToSvg(strokes, 300, 150);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 300 150"');
    expect(svg).toContain('M 10.0 20.0 L 30.0 40.0 L 50.0 60.0');
    expect(svg).toContain('</svg>');
  });
});
