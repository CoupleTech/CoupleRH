import React, { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
};

let globalConfirmResolver: ((val: boolean) => void) | null = null;
let globalSetOptions: ((opts: ConfirmOptions | null) => void) | null = null;

export const confirmDialog = (opts: string | ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    globalConfirmResolver = resolve;
    if (globalSetOptions) {
      globalSetOptions(typeof opts === 'string' ? { message: opts } : opts);
    }
  });
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    globalSetOptions = setOptions;
    return () => {
      globalSetOptions = null;
    };
  }, []);

  const handleConfirm = () => {
    setOptions(null);
    if (globalConfirmResolver) globalConfirmResolver(true);
  };

  const handleCancel = () => {
    setOptions(null);
    if (globalConfirmResolver) globalConfirmResolver(false);
  };

  return (
    <>
      {children}
      
      {options && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${options.isDestructive !== false ? 'bg-rose-100 text-rose-600' : 'bg-primary-100 text-primary-600'}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 font-display">
                {options.title || 'Confirmação'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {options.message}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  {options.cancelText || 'Cancelar'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-2 text-white font-bold rounded-xl transition-colors ${options.isDestructive !== false ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                >
                  {options.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
