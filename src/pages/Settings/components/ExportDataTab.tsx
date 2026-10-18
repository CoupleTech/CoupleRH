import { useState } from "react";
import { 
  Database, 
  Download, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  Building2, 
  Users, 
  Calculator, 
  Clock, 
  Lock,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { 
  TenantBackupService, 
  type BackupProgress 
} from "../../../services/settings/tenantBackupService";
import { LGPDService, RetentionDomain } from "../../../services/security/lgpdService";
import { supabase } from "../../../lib/supabase";

export default function ExportDataTab() {
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [exportingLgpd, setExportingLgpd] = useState(false);

  const handleExportFullBackup = async () => {
    try {
      setExportingBackup(true);
      setBackupProgress({
        stage: "Iniciando processo de backup...",
        percentage: 0,
        currentDomain: "INIT"
      });

      const backup = await TenantBackupService.generateCompleteBackup((prog) => {
        setBackupProgress(prog);
      });

      TenantBackupService.downloadBackupFile(backup);
      toast.success(
        `Backup completo gerado com sucesso! (${backup.manifest.summary.contracts} contratos e ${backup.manifest.summary.payslips} holerites exportados)`
      );
    } catch (err: any) {
      console.error("Erro ao gerar backup completo:", err);
      toast.error(err.message || "Falha ao gerar backup de dados do tenant.");
    } finally {
      setExportingBackup(false);
      setBackupProgress(null);
    }
  };

  const handleExportLgpdReport = async () => {
    try {
      setExportingLgpd(true);
      const { data: tenantUsers } = await supabase.from('tenant_users').select('tenant_id').limit(1).maybeSingle();
      const tenantId = tenantUsers?.tenant_id || '';

      const [sharings, requests, consents] = await Promise.all([
        LGPDService.fetchDataSharingRegistry(tenantId),
        supabase.from('lgpd_subject_requests').select('*').limit(100),
        supabase.from('lgpd_consents').select('*').limit(100)
      ]);

      const report = {
        title: 'Relatório Executivo de Governança e Conformidade LGPD (Lei nº 13.709/2018)',
        generatedAt: new Date().toISOString(),
        tenantId,
        framework: {
          normas: ['LGPD (Lei 13.709/2018)', 'CLT (Decreto-Lei 5.452/1943)', 'Portaria MTP 671/2021', 'Resolução CFM 1.851/2008'],
          principios: ['Finalidade', 'Adequação', 'Necessidade (Minimização)', 'Livre Acesso', 'Segurança e Confidencialidade']
        },
        politicasRetencao: [
          LGPDService.getRetentionPolicy(RetentionDomain.PAYROLL),
          LGPDService.getRetentionPolicy(RetentionDomain.TIME_TRACKING),
          LGPDService.getRetentionPolicy(RetentionDomain.SST_HEALTH),
          LGPDService.getRetentionPolicy(RetentionDomain.FGTS_PREVIDENCIA),
          LGPDService.getRetentionPolicy(RetentionDomain.SYSTEM_LOGS)
        ],
        registroCompartilhamentosTerceiros: sharings,
        estatisticasTitulares: {
          totalConsentimentosRegistrados: consents.data?.length || 0,
          solicitacoesTitularesRecebidas: requests.data?.length || 0
        }
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_lgpd_conformidade_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Relatório de Conformidade LGPD gerado e baixado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar relatório LGPD: ' + (err.message || 'Falha inesperada'));
    } finally {
      setExportingLgpd(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Cabeçalho da Aba */}
      <div className="card overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Exportação de Dados & Portabilidade LGPD
              </h2>
              <p className="text-sm text-slate-500">
                Geração de cópias de segurança integrais do tenant e relatórios de conformidade e privacidade.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Card 1: Backup Completo dos Dados */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm font-display flex items-center gap-2">
                    <Database size={16} className="text-teal-600" />
                    Backup Completo (Banco de Dados do Tenant)
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Art. 18, V LGPD
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Exporta um arquivo JSON estruturado contendo 100% dos dados da sua organização: cadastros, 
                  vínculos empregatícios, histórico de folhas, memórias de cálculo, apurações de ponto eletrônico e parâmetros.
                </p>
              </div>

              <button
                onClick={handleExportFullBackup}
                disabled={exportingBackup}
                className="btn-primary py-2.5 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 self-start md:self-auto"
              >
                {exportingBackup ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{exportingBackup ? "Exportando..." : "Gerar Backup Completo"}</span>
              </button>
            </div>

            {/* Barra de Progresso Durante o Backup */}
            {exportingBackup && backupProgress && (
              <div className="mt-5 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-teal-600" />
                    {backupProgress.stage}
                  </span>
                  <span className="text-teal-600">{backupProgress.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${backupProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Badges de Entidades Incluídas */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <Building2 size={12} className="text-slate-400" /> Organização & Filiais
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <Users size={12} className="text-slate-400" /> Trabalhadores & Contratos
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <Calculator size={12} className="text-slate-400" /> Folhas & Holerites
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <Clock size={12} className="text-slate-400" /> Ponto & Banco de Horas
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                <Lock size={12} className="text-slate-400" /> Parâmetros & SST
              </span>
            </div>
          </div>

          {/* Card 2: Relatório Executivo LGPD */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm font-display flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    Relatório Executivo de Conformidade LGPD
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Lei 13.709/2018
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Documento formal para auditorias e DPO contendo os prazos legais de guarda documental 
                  (trabalhista, previdenciário e médico), registro de compartilhamento com terceiros e estatísticas de titulares.
                </p>
              </div>

              <button
                onClick={handleExportLgpdReport}
                disabled={exportingLgpd}
                className="px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start md:self-auto border border-indigo-200"
              >
                {exportingLgpd ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{exportingLgpd ? "Gerando Relatório..." : "Gerar Relatório LGPD"}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Garantias de Segurança e Privacidade */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-800">Garantia de Confidencialidade e Portabilidade:</span>
              <p>
                Os pacotes exportados são gerados em formato JSON padronizado com codificação UTF-8, 
                garantindo a portabilidade irrestrita dos dados da empresa sem aprisionamento tecnológico (vendor lock-in), 
                em total observância à legislação brasileira e às diretrizes da ANPD.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
