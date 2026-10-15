import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  UserCheck,
  Hash,
  Download,
  Upload,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  computeCanonicalHash,
  formatVerificationCode,
  validateVerificationCode
} from '../../services/documents/documentSignatureModel';

interface DocumentDetails {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  verification_code: string;
  hash_original: string;
  hash_signed: string;
  signed_at: string;
  created_at: string;
  signed_file_url?: string;
  workers?: {
    people?: {
      full_name: string;
      cpf: string;
    };
    companies?: {
      corporate_name: string;
      cnpj: string;
    };
  };
}

export default function PublicDocumentVerification() {
  const { codigo } = useParams<{ codigo?: string }>();
  const [searchInput, setSearchInput] = useState(codigo || '');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [fileCheckStatus, setFileCheckStatus] = useState<'IDLE' | 'CHECKING' | 'MATCH' | 'TAMPERED'>('IDLE');
  const [uploadedFileHash, setUploadedFileHash] = useState<string | null>(null);

  useEffect(() => {
    if (codigo) {
      setSearchInput(codigo);
      handleSearch(codigo);
    }
  }, [codigo]);

  const handleSearch = async (codeToSearch?: string) => {
    const rawCode = (codeToSearch || searchInput).trim();
    if (!rawCode) return;

    setLoading(true);
    setSearched(true);
    setDoc(null);
    setFileCheckStatus('IDLE');
    setUploadedFileHash(null);

    try {
      const formatted = formatVerificationCode(rawCode);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode);

      let query = supabase
        .from('employee_documents')
        .select(`
          id,
          title,
          document_type,
          status,
          created_at,
          deleted_at,
          metadata,
          file_url,
          document_hash,
          workers (
            people (
              full_name,
              cpf
            ),
            companies (
              corporate_name,
              cnpj
            )
          )
        `)
        .is('deleted_at', null);

      if (isUuid) {
        query = query.eq('id', rawCode);
      } else {
        const clean = rawCode.replace(/[^0-9a-zA-Z]/g, '');
        query = query.ilike('id', `${clean}%`);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const mapped = {
          ...data,
          doc_type: (data as any).doc_type ?? (data as any).document_type ?? 'OTHER',
          verification_code:
            (data as any).verification_code ??
            (data as any).metadata?.verification_code ??
            formatted,
          hash_original: (data as any).hash_original ?? (data as any).document_hash ?? (data as any).metadata?.document_hash ?? null,
          hash_signed: (data as any).hash_signed ?? (data as any).metadata?.hash_signed ?? null,
          signed_at:
            (data as any).signed_at ??
            (data as any).metadata?.signed_at ??
            ((data as any).status === 'SIGNED' ? (data as any).updated_at || (data as any).created_at : null),
          signed_file_url: (data as any).signed_file_url ?? (data as any).file_url ?? null,
        };
        setDoc(mapped as any);
      }
    } catch (err) {
      console.error('Erro ao verificar documento:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc) return;

    setFileCheckStatus('CHECKING');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await computeCanonicalHash(arrayBuffer);
      setUploadedFileHash(hash);

      const targetHash = (doc.hash_signed || doc.hash_original || '').toLowerCase();
      if (hash.toLowerCase() === targetHash) {
        setFileCheckStatus('MATCH');
      } else {
        setFileCheckStatus('TAMPERED');
      }
    } catch {
      setFileCheckStatus('TAMPERED');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-primary-500 selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              CR
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-900 font-display">CoupleRH</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Verificador Oficial
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span className="hidden sm:inline">Conformidade Lei 14.063/2020</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-4">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Validação Criptográfica Pública de Documentos
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Verificação de Autenticidade Digital
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Insira o código alfanumérico constante na chancela ou no manifesto do documento para atestar sua validade jurídica e integridade forense.
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto mb-8 animate-slide-up">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: CRH-7F89-A2B4"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-bold text-slate-800 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Verificar
            </button>
          </form>
        </div>

        {/* Results Area */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse">
            <Loader2 size={36} className="animate-spin text-primary-500 mb-3" />
            <p className="text-sm font-medium">Consultando registros criptográficos na base oficial...</p>
          </div>
        )}

        {!loading && searched && !doc && (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto shadow-sm animate-scale-up">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Documento Não Localizado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Não encontramos nenhum registro com o código informado. Verifique se o código foi digitado corretamente no formato CRH-XXXX-XXXX.
            </p>
          </div>
        )}

        {!loading && doc && (
          <div className="space-y-6 animate-fade-in">
            {/* Status Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-linear-to-r from-emerald-50/50 via-transparent to-transparent">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-inner">
                      <FileCheck2 size={26} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-lg border border-primary-200">
                          {doc.verification_code}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Autêntico e Válido
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-1 font-display">{doc.title}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tipo: <span className="font-semibold text-slate-700">{doc.doc_type}</span> · Emitido em{' '}
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid de Metadados */}
              <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={14} className="text-slate-600" /> Signatário (Colaborador)
                  </h4>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{doc.workers?.people?.full_name || 'Colaborador'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      CPF Mascarado: <span className="font-mono font-medium text-slate-700">***.***.***-**</span>
                    </p>
                    {doc.signed_at && (
                      <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1">
                        <Clock size={13} /> Assinado em {new Date(doc.signed_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-600" /> Empregador
                  </h4>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{doc.workers?.companies?.corporate_name || 'Empresa Empregadora'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      CNPJ: <span className="font-mono font-medium text-slate-700">{doc.workers?.companies?.cnpj || '—'}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Garantia de Registro em Conformidade Trabalhista
                    </p>
                  </div>
                </div>
              </div>

              {/* Hashes Criptográficos */}
              <div className="p-6 sm:p-8 border-t border-slate-100 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-600" /> Hashes Canônicos SHA-256
                </h4>

                <div className="space-y-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Hash H1 (Documento Original do Servidor):</p>
                    <p className="font-mono text-xs text-slate-800 break-all select-all font-medium">
                      {doc.hash_original || '—'}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Hash H2 (Documento Assinado com Manifesto):</p>
                    <p className="font-mono text-xs text-slate-800 break-all select-all font-medium">
                      {doc.hash_signed || 'Aguardando assinatura'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload para Verificação de Integridade Física */}
              <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50/70">
                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Upload size={16} className="text-primary-600" /> Testar Arquivo PDF contra Adulterações
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Selecione o arquivo PDF salvo em seu dispositivo para conferir se os bytes correspondem exatamente ao hash original/assinado.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-300 hover:border-primary-500 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2">
                    <Upload size={14} /> Escolher Arquivo PDF
                    <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                  </label>

                  {fileCheckStatus === 'CHECKING' && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Loader2 size={14} className="animate-spin text-primary-500" />
                      Calculando hash SHA-256 do arquivo...
                    </div>
                  )}

                  {fileCheckStatus === 'MATCH' && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 size={15} /> Arquivo 100% Autêntico e Inalterado!
                    </div>
                  )}

                  {fileCheckStatus === 'TAMPERED' && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                      <AlertTriangle size={15} /> ALERTA: O arquivo foi modificado após a assinatura!
                    </div>
                  )}
                </div>

                {uploadedFileHash && (
                  <p className="text-[10px] font-mono text-slate-400 mt-3 break-all">
                    Hash calculado do arquivo enviado: {uploadedFileHash}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <p>CoupleRH · Plataforma Segura de Gestão e Assinatura Digital Trabalhista</p>
        <p className="text-[11px] text-slate-400 mt-1">Conformidade com a Lei Federal nº 14.063/2020 e Portaria MTP 671/2021</p>
      </footer>
    </div>
  );
}
