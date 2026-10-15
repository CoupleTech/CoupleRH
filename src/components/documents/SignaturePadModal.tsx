/**
 * SignaturePadModal.tsx
 * 
 * Componente modal de captura de rubrica na tela (desktop e mobile)
 * Suporta traços vetoriais com timestamps e imagem PNG
 * Previne scroll da página durante o desenho e valida preenchimento mínimo
 * 
 * Tarefa: AS-03 (Fase P6)
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, RotateCcw, Check, X, ShieldCheck, AlertCircle } from 'lucide-react';
import type { SignatureStrokePoint } from '../../services/documents/documentSignatureModel';
import { SignatureCanvasCore } from '../../services/documents/signatureCanvasCore';

export interface SignatureCaptureData {
  pngBase64: string;
  strokes: SignatureStrokePoint[][];
  width: number;
  height: number;
}

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: SignatureCaptureData) => void;
  documentTitle?: string;
  signerName?: string;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  documentTitle = 'Documento Trabalhista',
  signerName
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<SignatureStrokePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignatureStrokePoint[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redimensionar canvas com DPI correto
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(initCanvas, 100);
      setStrokes([]);
      setCurrentStroke([]);
      setValidationError(null);
    }
  }, [isOpen, initCanvas]);

  // Redesenha todos os traços no canvas
  const redraw = useCallback((strokeList: SignatureStrokePoint[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokeList) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capturar ponteiro para rastreio suave
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setValidationError(null);
    const newStroke: SignatureStrokePoint[] = [{ x, y, time: Date.now() }];
    setCurrentStroke(newStroke);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const point: SignatureStrokePoint = { x, y, time: Date.now() };
    setCurrentStroke(prev => [...prev, point]);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    setIsDrawing(false);
    if (currentStroke.length > 0) {
      const updated = [...strokes, currentStroke];
      setStrokes(updated);
      setCurrentStroke([]);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setValidationError(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    setValidationError(null);
    redraw(updated);
  };

  const handleConfirm = () => {
    const validation = SignatureCanvasCore.validateStrokes(strokes);
    if (!validation.valid) {
      setValidationError(validation.reason || 'Rubrica inválida.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSubmitting(true);
    try {
      const pngBase64 = canvas.toDataURL('image/png');
      const rect = canvas.getBoundingClientRect();
      onConfirm({
        pngBase64,
        strokes,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center shadow-inner">
              <PenTool size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-display">
                Desenhar Rubrica Digital
              </h2>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {documentTitle} {signerName ? `· ${signerName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              Assinatura Eletrônica Avançada (Lei 14.063/2020)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors flex items-center gap-1"
                title="Desfazer último traço"
              >
                <RotateCcw size={12} /> Desfazer
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-30 rounded-lg transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Touch Area */}
          <div className="relative w-full h-48 sm:h-56 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden cursor-crosshair touch-none select-none">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full block touch-none"
              style={{ touchAction: 'none' }}
            />

            {/* Linha guia de assinatura */}
            <div className="absolute inset-x-8 bottom-10 border-b border-slate-300 pointer-events-none flex justify-center">
              <span className="text-[10px] font-medium text-slate-400 -mt-4 bg-slate-50 px-2 select-none">
                Assine sobre a linha
              </span>
            </div>

            {strokes.length === 0 && !isDrawing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 select-none pb-8">
                <PenTool size={24} className="mb-1 opacity-40 animate-pulse" />
                <p className="text-xs font-medium">Use o dedo, caneta stylus ou o mouse para assinar</p>
              </div>
            )}
          </div>

          {validationError && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-500" />
              <span>{validationError}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-3 text-center">
            Ao confirmar, sua rubrica será vinculada aos hashes criptográficos do documento e auditada com carimbo de tempo, IP e dispositivo.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={strokes.length === 0 || isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 rounded-xl shadow-sm shadow-primary-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Check size={15} />
            Confirmar Rubrica
          </button>
        </div>
      </div>
    </div>
  );
};
