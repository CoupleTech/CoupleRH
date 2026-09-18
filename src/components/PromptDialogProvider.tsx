import React, { useState, useEffect, ReactNode, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

export type PromptOptions = {
  title?: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
};

let globalPromptResolver: ((val: string | null) => void) | null = null;
let globalSetOptions: ((opts: PromptOptions | null) => void) | null = null;

export const promptDialog = (opts: string | PromptOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    globalPromptResolver = resolve;
    if (globalSetOptions) {
      globalSetOptions(typeof opts === 'string' ? { message: opts } : opts);
    }
  });
};

export function PromptDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    globalSetOptions = (opts) => {
      setOptions(opts);
      if (opts) {
        setValue(opts.defaultValue || '');
      }
    };
    return () => {
      globalSetOptions = null;
    };
  }, []);

  useEffect(() => {
    if (options && inputRef.current) {
      inputRef.current.focus();
    }
  }, [options]);

  const handleConfirm = () => {
    setOptions(null);
    if (globalPromptResolver) globalPromptResolver(value);
  };

  const handleCancel = () => {
    setOptions(null);
    if (globalPromptResolver) globalPromptResolver(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
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
              <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center bg-primary-100 text-primary-600">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 font-display">
                {options.title || 'Informação necessária'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {options.message}
              </p>
              
              <div className="w-full mb-6">
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={options.placeholder || "Digite aqui..."}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-700"
                />
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  {options.cancelText || 'Cancelar'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!value.trim()}
                  className="flex-1 px-4 py-2 text-white font-bold rounded-xl transition-colors bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
