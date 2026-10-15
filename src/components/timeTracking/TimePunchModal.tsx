import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  ShieldCheck,
  QrCode,
  Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface TimePunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  workerName: string;
  workerCpf: string;
  companyName: string;
  companyCnpj: string;
  onPunchSuccess?: () => void;
}

interface PunchReceipt {
  punch_id: string;
  device_id: string;
  nsr: number;
  punched_at: string;
  receipt_code: string;
  entry_type: string;
  geo?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export const TimePunchModal: React.FC<TimePunchModalProps> = ({
  isOpen,
  onClose,
  contractId,
  workerName,
  workerCpf,
  companyName,
  companyCnpj,
  onPunchSuccess
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [entryType, setEntryType] = useState<'IN' | 'BREAK_START' | 'BREAK_END' | 'OUT'>('IN');
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    error: string | null;
    loading: boolean;
  }>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true
  });
  const [receipt, setReceipt] = useState<PunchReceipt | null>(null);

  // Relógio em tempo real
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Captura geolocalização ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      setReceipt(null);
      return;
    }

    if (!navigator.geolocation) {
      setGeoState({
        latitude: null,
        longitude: null,
        accuracy: null,
        error: 'Geolocalização não suportada no seu navegador/aparelho.',
        loading: false
      });
      return;
    }

    setGeoState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          error: null,
          loading: false
        });
      },
      (err) => {
        console.warn('Erro ao obter geolocalização:', err);
        setGeoState({
          latitude: null,
          longitude: null,
          accuracy: null,
          error: 'Permissão de GPS negada ou indisponível.',
          loading: false
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRegisterPunch = async () => {
    if (!contractId) {
      toast.error('Contrato de trabalho não identificado.');
      return;
    }

    setLoading(true);
    try {
      const geoPayload =
        geoState.latitude && geoState.longitude
          ? {
              latitude: geoState.latitude,
              longitude: geoState.longitude,
              accuracy: geoState.accuracy
            }
          : null;

      // Chama a RPC atômica register_mobile_punch
      const { data, error } = await supabase.rpc('register_mobile_punch', {
        p_contract_id: contractId,
        p_geo: geoPayload,
        p_device_fingerprint: navigator.userAgent,
        p_entry_type: entryType
      });

      if (error) throw error;

      const punchResult = Array.isArray(data) ? data[0] : data;

      if (!punchResult) {
        throw new Error('Falha ao registrar marcação.');
      }

      const receiptData: PunchReceipt = {
        punch_id: punchResult.punch_id,
        device_id: punchResult.device_id,
        nsr: Number(punchResult.nsr),
        punched_at: punchResult.punched_at,
        receipt_code: punchResult.receipt_code,
        entry_type: entryType,
        geo: geoPayload || undefined
      };

      setReceipt(receiptData);
      toast.success('Ponto registrado com sucesso! Comprovante emitido.');
      if (onPunchSuccess) onPunchSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar ponto: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      setLoading(false);
    }
  };

  const getEntryLabel = (type: string) => {
    switch (type) {
      case 'IN':
        return 'Entrada';
      case 'BREAK_START':
        return 'Saída Intervalo';
      case 'BREAK_END':
        return 'Retorno Intervalo';
      case 'OUT':
        return 'Saída';
      default:
        return 'Marcação';
    }
  };

  const formattedHours = String(currentTime.getHours()).padStart(2, '0');
  const formattedMinutes = String(currentTime.getMinutes()).padStart(2, '0');
  const formattedSeconds = String(currentTime.getSeconds()).padStart(2, '0');
  const formattedDate = currentTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Clock size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display leading-tight">Ponto Eletrônico</h2>
              <p className="text-xs text-white/80 font-medium">REP-P · Portaria MTP 671/2021</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!receipt ? (
            <>
              {/* Relógio Digital */}
              <div className="text-center bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-inner">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 capitalize">
                  {formattedDate}
                </p>
                <div className="text-4xl sm:text-5xl font-black font-mono text-slate-900 tracking-tight flex justify-center items-baseline gap-1">
                  <span>{formattedHours}</span>
                  <span className="text-primary-500 animate-pulse">:</span>
                  <span>{formattedMinutes}</span>
                  <span className="text-primary-500 animate-pulse">:</span>
                  <span className="text-xl sm:text-2xl text-slate-400 font-semibold">{formattedSeconds}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Horário oficial do servidor registrado na confirmação
                </p>
              </div>

              {/* Status do GPS */}
              <div className="flex items-center justify-between text-xs px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <MapPin size={15} className={geoState.latitude ? 'text-emerald-500' : 'text-amber-500'} />
                  Localização GPS
                </span>
                {geoState.loading ? (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Localizando...
                  </span>
                ) : geoState.latitude ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Ativo (~{geoState.accuracy}m)
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Teletrabalho / Sem GPS</span>
                )}
              </div>

              {/* Tipo de Marcação */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Tipo de Marcação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'IN', label: '1ª Entrada' },
                    { id: 'BREAK_START', label: 'Saída Almoço' },
                    { id: 'BREAK_END', label: 'Retorno Almoço' },
                    { id: 'OUT', label: '2ª Saída' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setEntryType(btn.id as any)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                        entryType === btn.id
                          ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão de Registro */}
              <button
                onClick={handleRegisterPunch}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-extrabold text-base shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Registrando e Autenticando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Confirmar Registro ({getEntryLabel(entryType)})</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* ━━━━ COMPROVANTE DE PONTO OFICIAL (PORTARIA 671) ━━━━ */
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-mono text-[11px] text-slate-800 shadow-inner">
                <div className="text-center border-b border-slate-200 pb-2">
                  <p className="font-bold text-xs uppercase tracking-wide">COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR</p>
                  <p className="text-[10px] text-slate-500">Portaria MTP nº 671/2021 — REP-P</p>
                </div>

                <div className="space-y-1">
                  <p><span className="text-slate-500">EMPREGADOR:</span> {companyName}</p>
                  <p><span className="text-slate-500">CNPJ:</span> {companyCnpj}</p>
                  <p><span className="text-slate-500">EMPREGADO:</span> {workerName}</p>
                  <p><span className="text-slate-500">CPF:</span> {workerCpf}</p>
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-1">
                  <p className="font-bold text-primary-600">
                    <span className="text-slate-500">TIPO:</span> {getEntryLabel(receipt.entry_type)}
                  </p>
                  <p>
                    <span className="text-slate-500">DATA/HORA:</span>{' '}
                    {new Date(receipt.punched_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                  <p>
                    <span className="text-slate-500">NSR:</span>{' '}
                    <span className="font-bold">{String(receipt.nsr).padStart(9, '0')}</span>
                  </p>
                  <p className="break-all text-[9px] text-slate-600">
                    <span className="text-slate-500">HASH SHA-256:</span> {receipt.receipt_code}
                  </p>
                </div>

                {/* QR Code Payload Representation */}
                <div className="border-t border-slate-200 pt-3 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center shadow-sm">
                    <QrCode size={70} className="text-slate-800" />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Conferência pública da autenticidade</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download size={16} />
                  <span>Imprimir Comprovante</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-primary-500/20"
                >
                  <span>Concluir</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimePunchModal;
