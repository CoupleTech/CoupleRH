import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Upload, 
  FileKey, 
  Lock, 
  Eye, 
  EyeOff, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { 
  CertificateService, 
  type CertificateUploadPayload 
} from "../../../services/settings/certificateService";

interface UploadCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCnpj?: string;
  defaultCompanyName?: string;
  environment?: 'producao' | 'restrita';
}

export default function UploadCertificateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultCnpj = "",
  defaultCompanyName = "",
  environment = 'producao'
}: UploadCertificateModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subjectName, setSubjectName] = useState(defaultCompanyName || "");
  const [cnpj, setCnpj] = useState(defaultCnpj || "");
  const [issuer, setIssuer] = useState("AC SERASA RFB v5");
  const [serialNumber, setSerialNumber] = useState("");
  
  // Datas padrão de vigência (1 ano a partir de hoje para simulação/preenchimento)
  const todayStr = new Date().toISOString().split("T")[0];
  const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [validFrom, setValidFrom] = useState(todayStr);
  const [validTo, setValidTo] = useState(nextYearStr);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pfx' && ext !== 'p12') {
      toast.error('O arquivo deve possuir extensão .pfx ou .p12 (padrão PKCS#12).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo do certificado excede o limite máximo permitido de 5MB.');
      return;
    }

    setSelectedFile(file);

    // Gerar um número de série simulado a partir do nome se ainda não preenchido
    if (!serialNumber) {
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      setSerialNumber(`ICP-BR-${hex}`);
    }

    // Se o titular estiver vazio, sugere com base no nome do arquivo
    if (!subjectName) {
      const cleanName = file.name.replace(/\.(pfx|p12)$/i, '').replace(/_/g, ' ').toUpperCase();
      setSubjectName(cleanName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Por favor, selecione o arquivo do certificado (.pfx ou .p12).');
      return;
    }

    if (!password) {
      toast.error('Informe a senha da chave privada do certificado digital.');
      return;
    }

    const payload: CertificateUploadPayload = {
      filename: selectedFile.name,
      password,
      subject_name: subjectName.trim(),
      cnpj: cnpj.trim(),
      issuer: issuer.trim(),
      serial_number: serialNumber.trim(),
      valid_from: new Date(validFrom + 'T00:00:00Z').toISOString(),
      valid_to: new Date(validTo + 'T23:59:59Z').toISOString(),
      environment
    };

    const validation = CertificateService.validatePayload(payload);
    if (!validation.valid) {
      toast.error(validation.error || 'Dados inválidos.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await CertificateService.saveCertificate(payload);
      if (res.success) {
        toast.success('Certificado Digital A1 instalado com sucesso!');
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || 'Erro ao instalar certificado digital.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha inesperada ao processar o certificado.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-xs">
              <FileKey size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 font-display text-base">
                Instalar Certificado Digital A1
              </h3>
              <p className="text-xs text-slate-500">
                Padrão ICP-Brasil (PKCS#12) para transmissões do eSocial ({environment === 'producao' ? 'Produção' : 'Produção Restrita'})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Upload Dropzone */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Arquivo do Certificado (.pfx ou .p12) *
            </label>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pfx,.p12,application/x-pkcs12"
              onChange={handleFileChange}
              className="hidden" 
            />

            {!selectedFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-primary-50/20 cursor-pointer transition-all group"
              >
                <Upload size={28} className="mx-auto text-slate-400 group-hover:text-primary-600 mb-2 transition-colors" />
                <p className="text-xs font-bold text-slate-700">Clique para selecionar o arquivo .pfx</p>
                <p className="text-[11px] text-slate-400 mt-1">Formatos suportados: .pfx ou .p12 (máx. 5MB)</p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-emerald-900 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Arquivo selecionado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* Senha do Certificado */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Senha da Chave Privada *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Informe a senha do arquivo .pfx"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={15} />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Necessária para abertura e assinatura digital das transmissões do eSocial.
            </p>
          </div>

          {/* Titular e CNPJ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Razão Social / Titular *
              </label>
              <input
                type="text"
                required
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                placeholder="Ex: MINHA EMPRESA LTDA"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                CNPJ do Certificado *
              </label>
              <input
                type="text"
                required
                value={cnpj}
                onChange={e => setCnpj(CertificateService.formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* Emissor e Número de Série */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Autoridade Emissora (AC) *
              </label>
              <input
                type="text"
                required
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                placeholder="Ex: AC SERASA RFB v5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Número de Série *
              </label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Ex: ICP-BR-7A3B9C1D"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* Prazos de Validade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Data de Emissão *
              </label>
              <input
                type="date"
                required
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Data de Expiração *
              </label>
              <input
                type="date"
                required
                value={validTo}
                onChange={e => setValidTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* Aviso de Segurança */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>
              Ao instalar este certificado, quaisquer certificados ativos anteriores do mesmo ambiente 
              serão automaticamente desativados no histórico com registro de auditoria forense T29.
            </p>
          </div>

          {/* Botões */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary py-2 px-5 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <FileKey size={15} />}
              <span>{submitting ? "Instalando..." : "Instalar Certificado A1"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
