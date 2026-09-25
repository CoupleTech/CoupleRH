import { useState, useEffect, useMemo, useRef } from "react";
import {
  CalendarDays,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Bell,
  LogOut,
  Loader2,
  Sun,
  Moon,
  Sunrise,
  Umbrella,
  AlertCircle,
  Briefcase,
  MapPin,
  Heart,
  CreditCard,
  User,
  Award,
  X,
  FileDown,
  UploadCloud,
  CheckCircle2,
  Clock,
  Check,
  PenTool,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { toast } from 'sonner';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateAvisoHTML, generateReciboHTML } from "../../utils/vacationPrint";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──
interface EmployeeAuth {
  isAuthenticated: boolean;
  workerId: string;
  personId: string;
  companyId: string;
  fullName: string;
}

interface EmployeeProfile {
  full_name: string;
  social_name: string | null;
  cpf: string;
  birth_date: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: {
    zip_code: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  emergency_contact: {
    name: string | null;
    phone: string | null;
    relation: string | null;
  };
  bank: {
    bank_name: string | null;
    agency: string | null;
    account_number: string | null;
    account_digit: string | null;
    account_type: string | null;
    pix_key: string | null;
    pix_type: string | null;
  };
  contract: {
    id: string;
    contract_type: string | null;
    contract_category: string | null;
    admission_date: string;
    base_salary: number;
    status: string;
    position_title: string | null;
    position_cbo: string | null;
    department_name: string | null;
  };
}

interface EmployeeBenefit {
  id: string;
  benefit_name: string;
  benefit_type: string;
  provider_name: string | null;
  discount_type: string;
  discount_value: number | null;
  card_number: string | null;
  dependent_count: number;
  status: string;
}

// ── Constants ──
const EXPECTED_DOCUMENTS = [
  "RG",
  "CPF",
  "CNH",
  "Comprovante de Endereço",
  "Certidão (Nascimento/Casamento)"
];

// ── Helpers ──
function getGreeting(): { text: string; icon: React.ReactNode } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Bom dia", icon: <Sunrise size={20} className="text-amber-400" /> };
  if (h < 18) return { text: "Boa tarde", icon: <Sun size={20} className="text-amber-500" /> };
  return { text: "Boa noite", icon: <Moon size={20} className="text-indigo-400" /> };
}

function maskCpf(cpf: string): string {
  if (!cpf || cpf.length < 11) return cpf || "—";
  const raw = cpf.replace(/\D/g, "");
  return `***.${raw.slice(3, 6)}.${raw.slice(6, 9)}-**`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function benefitTypeLabel(type: string): string {
  const map: Record<string, string> = {
    VT: "Vale Transporte",
    VR: "Vale Refeição",
    VA: "Vale Alimentação",
    HEALTH: "Plano de Saúde",
    DENTAL: "Plano Odontológico",
    GYM: "Academia",
    TRANSPORTATION: "Transporte",
    MEAL: "Refeição",
    FOOD: "Alimentação",
    HEALTH_INSURANCE: "Plano de Saúde",
    DENTAL_INSURANCE: "Plano Odontológico",
    LIFE_INSURANCE: "Seguro de Vida",
    OTHER: "Outro",
  };
  return map[type] || type;
}

function formatPayslipType(type: string): string {
  const map: Record<string, string> = {
    MONTHLY: "Mensal",
    ADVANCE: "Adiantamento",
    THIRTEENTH_1: "13º Primeira Parcela",
    THIRTEENTH_2: "13º Segunda Parcela",
    VACATION: "Férias",
    TERMINATION: "Rescisão"
  };
  return map[type] || type;
}

function benefitIcon(type: string): React.ReactNode {
  const map: Record<string, React.ReactNode> = {
    VT: <MapPin size={16} className="text-blue-600" />,
    VR: <DollarSign size={16} className="text-orange-600" />,
    VA: <DollarSign size={16} className="text-green-600" />,
    HEALTH: <Heart size={16} className="text-rose-600" />,
    DENTAL: <Heart size={16} className="text-purple-600" />,
    GYM: <Award size={16} className="text-cyan-600" />,
    HEALTH_INSURANCE: <Heart size={16} className="text-rose-600" />,
    DENTAL_INSURANCE: <Heart size={16} className="text-purple-600" />,
    LIFE_INSURANCE: <ShieldCheck size={16} className="text-emerald-600" />,
  };
  return map[type] || <Briefcase size={16} className="text-slate-600" />;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

// ── Collapsible Section ──
function Section({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
  headerAction,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  headerAction?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50/50">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-3 text-left active:bg-slate-100/50"
        >
          {icon}
          <span className="text-sm font-bold text-slate-800 font-display">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 ring-1 ring-primary-200">
              {badge}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ml-1 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {headerAction && <div className="ml-3 shrink-0">{headerAction}</div>}
      </div>
      {open && <div className="px-5 pb-5 border-t border-slate-50">{children}</div>}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right ml-4 truncate">{value || "—"}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function EmployeePortal() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [auth, setAuth] = useState<EmployeeAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [benefits, setBenefits] = useState<EmployeeBenefit[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [vacationBalance, setVacationBalance] = useState<any>(null);

  // Documentos
  const [personalDocs, setPersonalDocs] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsActiveTab, setDocsActiveTab] = useState<"pessoais" | "assinaturas">("pessoais");
  
  // Vacation print modal
  const [showVacationDoc, setShowVacationDoc] = useState(false);
  const [vacationDocHtml, setVacationDocHtml] = useState("");
  const [vacationDocTitle, setVacationDocTitle] = useState("");
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [signingDocId, setSigningDocId] = useState<string | null>(null);
  const [documentToView, setDocumentToView] = useState<any | null>(null);

  // Payslip Selection & Details
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [payslipDetails, setPayslipDetails] = useState<any>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [loadingPayslipDetails, setLoadingPayslipDetails] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = auth?.fullName?.split(" ")[0] || "";

  useEffect(() => {
    const authDataStr = localStorage.getItem("@coupleRH:employeeAuth");
    if (!authDataStr) {
      navigate("/portal/login");
      return;
    }

    try {
      const parsedAuth = JSON.parse(authDataStr) as EmployeeAuth;
      if (!parsedAuth.isAuthenticated) {
        navigate("/portal/login");
        return;
      }
      setAuth(parsedAuth);
      fetchPortalData(parsedAuth.workerId);
    } catch (err) {
      navigate("/portal/login");
    }
  }, []);

  const fetchPortalData = async (workerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [
        profileRes,
        benefitsRes,
        payslipRes,
        vacationRes,
        pDocsRes,
        sigRes
      ] = await Promise.allSettled([
        supabase.rpc("get_employee_profile", { p_worker_id: workerId }),
        supabase.rpc("get_employee_benefits", { p_worker_id: workerId }),
        supabase.rpc("get_employee_payslips", { p_worker_id: workerId }),
        supabase.rpc("get_employee_vacation_balance", { p_worker_id: workerId }),
        supabase.rpc("get_worker_personal_documents", { p_worker_id: workerId }),
        supabase.rpc("get_worker_signatures", { p_worker_id: workerId })
      ]);

      if (profileRes.status === "fulfilled" && !profileRes.value.error) setProfile(profileRes.value.data);
      if (benefitsRes.status === "fulfilled" && !benefitsRes.value.error) setBenefits(benefitsRes.value.data);
      
      if (payslipRes.status === "fulfilled" && !payslipRes.value.error) {
        const data = payslipRes.value.data;
        if (data && data.length > 0) {
          setPayslips(data);
          setSelectedPayslipId(data[0].id);
        }
      }

      if (vacationRes.status === "fulfilled" && !vacationRes.value.error) {
        const data = vacationRes.value.data;
        if (data && data.length > 0) setVacationBalance(data[0]);
      }

      if (pDocsRes.status === "fulfilled" && !pDocsRes.value.error) setPersonalDocs(pDocsRes.value.data || []);
      if (sigRes.status === "fulfilled" && !sigRes.value.error) setSignatures(sigRes.value.data || []);

    } catch (err: any) {
      setError("Não foi possível carregar seus dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocsData = async () => {
    if (!auth) return;
    const [pDocsRes, sigRes] = await Promise.all([
      supabase.rpc("get_worker_personal_documents", { p_worker_id: auth.workerId }),
      supabase.rpc("get_worker_signatures", { p_worker_id: auth.workerId })
    ]);
    if (!pDocsRes.error) setPersonalDocs(pDocsRes.data || []);
    if (!sigRes.error) setSignatures(sigRes.data || []);
  };

  const handleOpenPayslipModal = async (payslipId: string) => {
    if (!auth) return;
    setShowPayslipModal(true);
    setLoadingPayslipDetails(true);
    try {
      const { data, error } = await supabase.rpc("get_employee_payslip_details", {
        p_payslip_id: payslipId,
        p_worker_id: auth.workerId,
      });
      if (error) throw error;
      setPayslipDetails(data);
    } catch (err) {
      console.error("Erro ao buscar detalhes do holerite:", err);
    } finally {
      setLoadingPayslipDetails(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!payslipDetails || !profile) return;
    
    // Find the payslip to get period details
    const currentPayslip = payslips.find(p => p.id === selectedPayslipId) || payslips[0];
    if (!currentPayslip) return;

    const doc = new jsPDF('portrait');
    
    // Header
    doc.setFontSize(16);
    doc.text("Recibo de Pagamento de Salário", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Colaborador: ${profile.full_name}`, 14, 30);
    doc.text(`Cargo: ${profile.contract?.position_title || 'N/A'}`, 14, 36);
    doc.text(`Competência: ${String(currentPayslip.period_month).padStart(2, '0')}/${currentPayslip.period_year}`, 14, 42);

    // Items
    const tableData = payslipDetails.items?.map((item: any) => [
      item.code || "—",
      item.name,
      item.reference || "—",
      item.type === 'EARNING' ? formatCurrency(item.amount) : "",
      item.type === 'DEDUCTION' ? formatCurrency(item.amount) : ""
    ]) || [];

    autoTable(doc, {
      startY: 50,
      head: [['Cód.', 'Descrição', 'Ref.', 'Vencimentos', 'Descontos']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right', textColor: [5, 150, 105] },
        4: { halign: 'right', textColor: [225, 29, 72] }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    
    autoTable(doc, {
      startY: finalY + 5,
      body: [
        ['Total de Vencimentos', formatCurrency(payslipDetails.totals?.total_earnings)],
        ['Total de Descontos', formatCurrency(payslipDetails.totals?.total_deductions)],
        ['Líquido a Receber', formatCurrency(payslipDetails.totals?.net_salary)]
      ],
      theme: 'plain',
      styles: { fontSize: 10, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'right' },
        1: { halign: 'right', cellWidth: 40 }
      }
    });

    doc.save(`holerite_${currentPayslip.period_month}_${currentPayslip.period_year}.pdf`);
  };

  const handlePrintVacation = async (req: any, type: 'aviso' | 'recibo') => {
    if (!profile || !auth) return;
    
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', auth.companyId)
        .single();
        
      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      const today = new Date();
      
      const formatDt = (d: Date) => d.toLocaleDateString('pt-BR');
      
      const documentData = {
        empresa: company?.corporate_name || "EMPRESA PADRÃO",
        cnpj: company?.cnpj || "",
        endereco: company?.address ? `${company.address.street}, ${company.address.number}` : "",
        cidade: company?.address?.city || "São Paulo",
        bairro: company?.address?.neighborhood || "",
        cep: company?.address?.zip_code || "",
        
        empregado: profile.full_name,
        ctps: profile.cpf || "", // Usando CPF como fallback caso não haja CTPS no profile
        registro: "-", 
        funcao: profile.contract?.position_title || "",
        bancoAgencia: profile.bank ? `${profile.bank.bank_name || ''} / ${profile.bank.agency || ''}` : "",
        contaCorrente: profile.bank?.account_number || "",
        centroCusto: profile.contract?.department_name || "",
        
        dataEmissao: formatDt(today),
        dataPagamento: formatDt(new Date(startDate.getTime() - 2 * 24 * 60 * 60 * 1000)),
        
        paInicio: vacationBalance?.period_start ? formatDt(new Date(vacationBalance.period_start)) : "",
        paFim: vacationBalance?.period_end ? formatDt(new Date(vacationBalance.period_end)) : "",
        gozoInicio: formatDt(startDate),
        gozoFim: formatDt(endDate),
        gozoStartDateRaw: startDate.toISOString(),
        
        diasGozo: req.days_taken,
        diasAbono: req.cash_allowance_days || 0,
        salarioBase: profile.contract?.base_salary || 0,
      };
      
      const html = type === 'aviso' ? generateAvisoHTML(documentData, false) : generateReciboHTML(documentData, false);
      
      setVacationDocHtml(html);
      setVacationDocTitle(type === 'aviso' ? 'Aviso de Férias' : 'Recibo de Férias');
      setShowVacationDoc(true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar documento de férias.");
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(newFile);
              } else {
                resolve(file); // fallback se falhar
              }
            },
            "image/jpeg",
            0.7 // qualidade 70%
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadingDocType || !auth) {
      setUploadingDocType(null);
      return;
    }
    let file = e.target.files[0];
    
    // Se não for imagem (ex: PDF), checar tamanho máx 3MB
    if (!file.type.startsWith("image/")) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error("O documento deve ter no máximo 3MB.");
        setUploadingDocType(null);
        return;
      }
    } else {
      // Se for imagem, comprimir
      try {
        file = await compressImage(file);
      } catch (err) {
        console.error("Erro ao comprimir imagem", err);
      }
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${auth.workerId}/${uploadingDocType.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;

    try {
      // 1. Upload to Storage (bucket 'employee-documents' must allow ANON insert for this path)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL (if public) or just save the path
      const { data: publicUrlData } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(fileName);

      // 3. Register in DB
      const { error: dbError } = await supabase.rpc('submit_worker_personal_document', {
        p_worker_id: auth.workerId,
        p_document_type: uploadingDocType,
        p_file_url: publicUrlData.publicUrl
      });

      if (dbError) throw dbError;

      // Refresh docs
      await fetchDocsData();
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Ocorreu um erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setUploadingDocType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSignDocument = async (docId: string, metadata: any) => {
    if (!auth) return;
    setSigningDocId(docId);
    try {
      // Obter IP do usuário (para validade legal MP 2.200-2)
      let ipAddress = '0.0.0.0';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP", e);
      }
      
      const userAgent = navigator.userAgent;
      
      // Hash simples do metadados para garantir que o que foi assinado era isso
      const documentHash = btoa(JSON.stringify(metadata) + Date.now().toString());

      const { error } = await supabase.rpc('sign_worker_document', {
        p_document_id: docId,
        p_worker_id: auth.workerId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_document_hash: documentHash
      });
      if (error) throw error;
      
      toast.error("Documento assinado com sucesso!");
      setDocumentToView(null);
      await fetchDocsData();
    } catch (err: any) {
      toast.error("Falha ao assinar documento: " + err.message);
    } finally {
      setSigningDocId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("@coupleRH:employeeAuth");
    navigate("/portal/login");
  };

  if (!auth) return null;

  // ── Calculations ──
  const vacDaysRemaining = vacationBalance
    ? vacationBalance.days_earned - (vacationBalance.days_taken || 0) - (vacationBalance.days_lost || 0)
    : 0;
  const vacProgress = vacationBalance
    ? Math.min(100, ((vacationBalance.days_taken || 0) / vacationBalance.days_earned) * 100)
    : 0;

  const admissionDate = profile?.contract?.admission_date;
  const admissionYears = admissionDate
    ? Math.floor((Date.now() - new Date(admissionDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  const activePayslip = payslips.find((p) => p.id === selectedPayslipId) || payslips[0];

  // Document Pending Calculation
  const missingPersonalDocs = EXPECTED_DOCUMENTS.filter(type => {
    const doc = personalDocs.find(d => d.document_type === type);
    return !doc || doc.status === 'REJECTED';
  }).length;
  
  const pendingSignatures = signatures.filter(s => s.status === 'PENDING_SIGNATURE').length;
  const totalPendingDocs = missingPersonalDocs + pendingSignatures;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* ━━━━ Sticky Header ━━━━ */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 safe-area-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-md shadow-primary-500/20">
              <span className="text-white font-extrabold text-sm font-display">cR</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900 font-display truncate max-w-[160px] sm:max-w-none">
                {firstName}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">Portal do Colaborador</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className="relative p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              aria-label="Notificações"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 transition-colors"
              aria-label="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ━━━━ Content ━━━━ */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* ── Greeting ── */}
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-1">
            {greeting.icon}
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
              {greeting.text}, {firstName}!
            </h1>
          </div>
          {profile?.contract?.position_title && (
            <p className="text-sm text-slate-500 pl-7">
              {profile.contract.position_title}
              {profile.contract.department_name && ` · ${profile.contract.department_name}`}
            </p>
          )}
        </div>

        {/* ── Error State ── */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-up">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
              <button
                onClick={() => auth && fetchPortalData(auth.workerId)}
                className="text-sm text-red-600 font-semibold underline underline-offset-2 mt-1 hover:text-red-800 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {loading ? (
          /* ── Loading Skeleton ── */
          <div className="space-y-4 animate-fade-up">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-16 h-3" />
                </div>
              ))}
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                <Skeleton className="w-40 h-5" />
                <Skeleton className="w-full h-10" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ━━━━ Quick Actions Grid ━━━━ */}
            <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-1">
              {/* Holerite */}
              <button 
                onClick={() => payslips.length > 0 && handleOpenPayslipModal(activePayslip.id)}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 p-4 text-left transition-all duration-200 active:scale-[0.97]">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <DollarSign size={20} className="text-emerald-600" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 leading-tight">Holerite</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {payslips.length > 0
                    ? `${String(payslips[0].period_month).padStart(2, "0")}/${payslips[0].period_year}`
                    : "—"}
                </p>
              </button>

              {/* Férias */}
              <button className="group bg-white rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/5 p-4 text-left transition-all duration-200 active:scale-[0.97]">
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <Umbrella size={20} className="text-amber-600" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 leading-tight">Férias</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {vacationBalance ? `${vacDaysRemaining} dias` : "—"}
                </p>
              </button>

              {/* Documentos */}
              <button 
                onClick={() => setShowDocsModal(true)}
                className="group relative bg-white rounded-2xl border border-slate-100 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/5 p-4 text-left transition-all duration-200 active:scale-[0.97]"
              >
                <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <FileText size={20} className="text-rose-600" />
                </div>
                {totalPendingDocs > 0 && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shadow-rose-500/30">
                    {totalPendingDocs}
                  </div>
                )}
                <h3 className="text-xs font-bold text-slate-800 leading-tight">Documentos</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {totalPendingDocs > 0 ? `${totalPendingDocs} pendência${totalPendingDocs > 1 ? 's' : ''}` : 'Tudo certo'}
                </p>
              </button>
            </div>

            {/* ━━━━ Holerites ━━━━ */}
            <div className="animate-fade-up stagger-2">
              <Section
                title="Meus Holerites"
                icon={<DollarSign size={18} className="text-emerald-600" />}
                defaultOpen={true}
                headerAction={
                  payslips.length > 0 && (
                    <select
                      value={selectedPayslipId || ""}
                      onChange={(e) => setSelectedPayslipId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full px-2.5 py-1.5 appearance-none font-medium cursor-pointer transition-colors hover:bg-slate-100 outline-none"
                    >
                      {payslips.map((p) => (
                        <option key={p.id} value={p.id}>
                          {String(p.period_month).padStart(2, "0")}/{p.period_year} - {formatPayslipType(p.period_type)}
                        </option>
                      ))}
                    </select>
                  )
                }
              >
                {activePayslip ? (
                  <div className="pt-3">
                    <button
                      onClick={() => handleOpenPayslipModal(activePayslip.id)}
                      className="w-full group relative overflow-hidden flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 rounded-xl transition-all duration-300 text-left active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 bg-emerald-100/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                      
                      <div className="relative z-10">
                        <p className="text-sm font-bold text-slate-800 tabular-nums">
                          {String(activePayslip.period_month).padStart(2, "0")}/{activePayslip.period_year}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatPayslipType(activePayslip.period_type)}
                        </p>
                      </div>
                      <div className="relative z-10 text-right flex flex-col items-end">
                        <p className="text-lg font-extrabold text-emerald-700 tabular-nums font-display">
                          {formatCurrency(activePayslip.net_salary)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            {activePayslip.status === "CLOSED" ? "Fechado" : activePayslip.status}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200/50 group-hover:bg-emerald-200 transition-colors">
                            Detalhes <ChevronRight size={12} />
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <DollarSign size={24} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum holerite disponível.</p>
                  </div>
                )}
              </Section>
            </div>

            {/* ━━━━ Resumo de Férias ━━━━ */}
            <div className="animate-fade-up stagger-3">
              <Section
                title="Férias"
                icon={<CalendarDays size={18} className="text-amber-600" />}
              >
                {vacationBalance ? (
                  <div className="pt-3 space-y-4">
                    {/* Período Aquisitivo Aberto */}
                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                      <div className="flex justify-between items-baseline text-sm mb-2">
                        <span className="font-medium text-slate-700">
                          Período {new Date(vacationBalance.start_date).getFullYear()}/{new Date(vacationBalance.end_date).getFullYear()}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums text-base">
                          {vacDaysRemaining} <span className="text-xs font-medium text-slate-500">dias</span>
                        </span>
                      </div>

                      <div className="w-full bg-slate-200/60 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${vacProgress}%`,
                            background:
                              vacProgress > 80
                                ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                                : "linear-gradient(90deg, #10b981, #059669)",
                          }}
                        />
                      </div>

                      <div className="flex justify-between mt-2">
                        <p className="text-[11px] font-medium text-slate-500">{vacationBalance.days_taken || 0} dias gozados</p>
                        <p className="text-[11px] font-medium text-slate-500">{vacationBalance.days_earned} dias adquiridos</p>
                      </div>

                      {vacationBalance.concessive_end_date && (
                        <div className="mt-3 pt-3 border-t border-amber-200/60">
                          <p className="text-[11px] text-amber-700/80 font-medium flex items-center justify-between">
                            <span>Período concessivo até</span>
                            <span className="font-bold text-amber-800">
                              {formatDate(vacationBalance.concessive_end_date)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Férias Programadas */}
                    {vacationBalance.requests && vacationBalance.requests.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Férias Programadas</h4>
                        {vacationBalance.requests.map((req: any) => (
                          <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm shadow-slate-200/20">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {formatDate(req.start_date)} a {formatDate(req.end_date)}
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                  {req.days_taken} dias solicitados
                                </p>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                                {req.status === 'APPROVED_DP' || req.status === 'PAID' ? 'Aprovado' : req.status === 'TAKEN' ? 'Concluído' : 'Solicitado'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button 
                                onClick={() => handlePrintVacation(req, 'aviso')}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <FileText size={14} /> Aviso
                              </button>
                              <button 
                                onClick={() => handlePrintVacation(req, 'recibo')}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                <FileText size={14} /> Recibo
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CalendarDays size={24} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum período aquisitivo encontrado.</p>
                  </div>
                )}
              </Section>
            </div>

            {/* ━━━━ Dados Pessoais / Profissionais ━━━━ */}
            {profile && (
              <div className="animate-fade-up stagger-4 space-y-5">
                <Section
                  title="Dados Pessoais"
                  icon={<User size={18} className="text-blue-600" />}
                >
                  <div className="pt-3 space-y-1">
                    <DataRow label="Nome Completo" value={profile.full_name} />
                    {profile.social_name && <DataRow label="Nome Social" value={profile.social_name} />}
                    <DataRow label="CPF" value={maskCpf(profile.cpf)} />
                    <DataRow label="Data de Nasc." value={formatDate(profile.birth_date)} />
                  </div>
                </Section>

                <Section
                  title="Contato e Endereço"
                  icon={<MapPin size={18} className="text-indigo-600" />}
                >
                  <div className="pt-3 space-y-1">
                    <DataRow label="E-mail" value={profile.email?.toLowerCase()} />
                    <DataRow label="Celular" value={profile.mobile || profile.phone} />
                    <DataRow 
                      label="Endereço" 
                      value={profile.address?.street ? `${profile.address.street}, ${profile.address.number || 'S/N'}${profile.address.complement ? ' - ' + profile.address.complement : ''} - ${profile.address.neighborhood || ''}, ${profile.address.city || ''}/${profile.address.state || ''}` : "—"} 
                    />
                  </div>
                </Section>

                <Section
                  title="Dados Bancários"
                  icon={<CreditCard size={18} className="text-purple-600" />}
                >
                  <div className="pt-3 space-y-1">
                    <DataRow label="Banco" value={profile.bank?.bank_name} />
                    <DataRow label="Agência" value={profile.bank?.agency} />
                    <DataRow label="Conta" value={profile.bank?.account_number ? `${profile.bank.account_number}-${profile.bank.account_digit || ''}` : "—"} />
                    <DataRow label="Tipo de Conta" value={profile.bank?.account_type === 'CURRENT' ? 'Conta Corrente' : profile.bank?.account_type === 'SAVINGS' ? 'Conta Poupança' : profile.bank?.account_type || "—"} />
                    {profile.bank?.pix_key && <DataRow label="Chave PIX" value={profile.bank.pix_key} />}
                  </div>
                </Section>
              </div>
            )}
          </>
        )}
      </main>

      {/* ━━━━ MODAL: Central de Documentos ━━━━ */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="bg-white rounded-3xl w-full max-w-lg h-[85vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Escondido input de arquivo para upload */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,.pdf"
              onChange={handleFileUpload} 
            />

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <FileText size={20} className="text-rose-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 font-display">Central de Documentos</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {totalPendingDocs > 0 ? `${totalPendingDocs} ação(ões) necessária(s)` : "Tudo em dia!"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDocsModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-slate-100">
              <button 
                className={`flex-1 py-3 text-sm font-bold font-display border-b-2 transition-colors ${docsActiveTab === 'pessoais' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setDocsActiveTab('pessoais')}
              >
                Meus Documentos
                {missingPersonalDocs > 0 && <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-rose-500 text-white rounded-full text-[9px]">{missingPersonalDocs}</span>}
              </button>
              <button 
                className={`flex-1 py-3 text-sm font-bold font-display border-b-2 transition-colors ${docsActiveTab === 'assinaturas' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setDocsActiveTab('assinaturas')}
              >
                Assinaturas
                {pendingSignatures > 0 && <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-rose-500 text-white rounded-full text-[9px]">{pendingSignatures}</span>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              {docsActiveTab === 'pessoais' ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 px-1">Envie os documentos solicitados pelo RH. Tire uma foto nítida ou anexe o PDF.</p>
                  
                  {EXPECTED_DOCUMENTS.map((docType) => {
                    const doc = personalDocs.find(d => d.document_type === docType);
                    const isPending = !doc || doc.status === 'REJECTED';
                    const isUploading = uploadingDocType === docType;

                    return (
                      <div key={docType} className={`flex items-center justify-between p-4 rounded-xl border ${isPending ? 'bg-white border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                        <div>
                          <p className={`text-sm font-bold ${isPending ? 'text-slate-800' : 'text-slate-600'}`}>{docType}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {!doc ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Pendente</span>
                            ) : doc.status === 'SUBMITTED' ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock size={10} /> Em Análise</span>
                            ) : doc.status === 'REJECTED' ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1"><AlertCircle size={10} /> Rejeitado - Reenviar</span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1"><CheckCircle2 size={10} /> Aprovado</span>
                            )}
                          </div>
                        </div>
                        
                        {(isPending || doc?.status === 'REJECTED') && (
                          <button
                            disabled={isUploading}
                            onClick={() => {
                              setUploadingDocType(docType);
                              fileInputRef.current?.click();
                            }}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                            Enviar
                          </button>
                        )}
                        
                        {doc?.status === 'APPROVED' && (
                          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                            <Check size={16} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {signatures.length === 0 ? (
                    <div className="text-center py-12">
                      <ShieldCheck size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-medium text-slate-500">Nenhum documento aguardando assinatura.</p>
                    </div>
                  ) : (
                    signatures.map(sig => (
                      <div key={sig.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm shadow-slate-200/20">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800 pr-4">{sig.title}</p>
                            <p className="text-[11px] font-medium text-slate-500 mt-1">Enviado em {new Date(sig.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        
                        {sig.status === 'PENDING_SIGNATURE' ? (
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                            <button 
                              onClick={() => setDocumentToView(sig)}
                              className="flex-1 py-2 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                            >
                              Ler Documento
                            </button>
                            <button 
                              onClick={() => handleSignDocument(sig.id, sig.metadata)}
                              disabled={signingDocId === sig.id}
                              className="flex-1 py-2 text-[11px] font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm shadow-primary-500/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {signingDocId === sig.id ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
                              Assinar Eletronicamente
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                              <CheckCircle2 size={14} /> Assinado digitalmente
                            </span>
                            <button 
                              onClick={() => setDocumentToView(sig)}
                              className="ml-auto py-1 px-3 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                            >
                              Ver Documento
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━ MODAL: Detalhes do Holerite ━━━━ */}
      {showPayslipModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <DollarSign size={20} className="text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 font-display">Demonstrativo de Pagamento</h2>
                  {activePayslip && (
                    <p className="text-xs font-medium text-slate-500">
                      Ref: {String(activePayslip.period_month).padStart(2, "0")}/{activePayslip.period_year} · {formatPayslipType(activePayslip.period_type)}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowPayslipModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingPayslipDetails ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="text-primary-500 animate-spin mb-3" />
                  <p className="text-sm font-medium text-slate-500">Carregando detalhes do holerite...</p>
                </div>
              ) : payslipDetails ? (
                <div className="space-y-6">
                  {/* Empresa e Funcionario Info */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Colaborador:</span>
                      <span className="font-semibold text-slate-800 text-right">{profile?.full_name}</span>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <span className="text-slate-500">Cargo:</span>
                      <span className="font-medium text-slate-800 text-right">{profile?.contract?.position_title}</span>
                    </div>
                  </div>

                  {/* Tabela de Eventos */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5 font-medium whitespace-nowrap border-b border-slate-200">Cód.</th>
                            <th className="px-3 py-2.5 font-medium border-b border-slate-200 w-full">Descrição</th>
                            <th className="px-3 py-2.5 font-medium text-right border-b border-slate-200">Ref.</th>
                            <th className="px-3 py-2.5 font-medium text-right border-b border-slate-200">Venc.</th>
                            <th className="px-3 py-2.5 font-medium text-right border-b border-slate-200">Desc.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {payslipDetails.items?.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-3 py-3 text-slate-400 tabular-nums">{item.code || "—"}</td>
                              <td className="px-3 py-3 font-medium text-slate-800 min-w-[120px]">{item.name}</td>
                              <td className="px-3 py-3 text-slate-500 text-right whitespace-nowrap">{item.reference || "—"}</td>
                              <td className="px-3 py-3 text-emerald-600 font-semibold text-right tabular-nums whitespace-nowrap">
                                {item.type === 'EARNING' ? formatCurrency(item.amount) : ""}
                              </td>
                              <td className="px-3 py-3 text-rose-600 font-semibold text-right tabular-nums whitespace-nowrap">
                                {item.type === 'DEDUCTION' ? formatCurrency(item.amount) : ""}
                              </td>
                            </tr>
                          ))}
                          {(!payslipDetails.items || payslipDetails.items.length === 0) && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                Nenhum detalhe encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                          <tr>
                            <td colSpan={3} className="px-3 py-3 font-semibold text-slate-600 text-right">Totais:</td>
                            <td className="px-3 py-3 font-bold text-emerald-700 text-right tabular-nums whitespace-nowrap">
                              {formatCurrency(payslipDetails.totals?.total_earnings)}
                            </td>
                            <td className="px-3 py-3 font-bold text-rose-700 text-right tabular-nums whitespace-nowrap">
                              {formatCurrency(payslipDetails.totals?.total_deductions)}
                            </td>
                          </tr>
                          <tr className="bg-emerald-50/50 border-t border-emerald-100">
                            <td colSpan={3} className="px-3 py-3 font-bold text-slate-800 text-right uppercase text-[11px] tracking-wider">
                              Valor Líquido:
                            </td>
                            <td colSpan={2} className="px-3 py-3 font-black text-emerald-700 text-right text-sm tabular-nums font-display">
                              {formatCurrency(payslipDetails.totals?.net_salary)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Bases de Cálculo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm shadow-slate-200/20">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Base INSS</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(payslipDetails.totals?.base_inss)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm shadow-slate-200/20">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Base IRRF</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(payslipDetails.totals?.base_irrf)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm shadow-slate-200/20">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Base FGTS</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(payslipDetails.totals?.base_fgts)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm shadow-slate-200/20">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">FGTS Mês</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(payslipDetails.totals?.fgts_month)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <AlertCircle size={32} className="mb-3 text-slate-300" />
                  <p className="text-sm">Não foi possível carregar o detalhamento.</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <FileDown size={16} /> Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━ MODAL: Visualização de Documento (RH Paperless) ━━━━ */}
      {documentToView && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <FileText size={20} className="text-primary-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">{documentToView.title}</h2>
                  <p className="text-xs font-medium text-slate-500">Visualização do documento original</p>
                </div>
              </div>
              <button 
                onClick={() => setDocumentToView(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Document Viewer */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
              <div className="bg-white border border-slate-300 p-8 shadow-sm min-h-[500px] text-slate-800 font-serif leading-relaxed">
                {documentToView.document_type === 'VACATION_NOTICE' && documentToView.metadata && (
                  <div className="space-y-6">
                    <h1 className="text-xl font-bold text-center underline uppercase mb-8">Aviso de Férias</h1>
                    
                    <p>Ao(à) Sr(a). <strong>{profile?.full_name}</strong></p>
                    
                    <p className="text-justify indent-8">
                      Nos termos das disposições legais vigentes, comunicamos que lhe serão concedidas férias, 
                      relativas ao período aquisitivo de <strong>{new Date(documentToView.metadata.startDate).toLocaleDateString('pt-BR')}</strong>, 
                      num total de <strong>{documentToView.metadata.vacationDays}</strong> dias.
                    </p>
                    
                    <p className="text-justify indent-8">
                      Seu período de gozo de férias terá início em <strong>{new Date(documentToView.metadata.startDate).toLocaleDateString('pt-BR')}</strong> e 
                      terminará em <strong>{new Date(new Date(documentToView.metadata.startDate).getTime() + (documentToView.metadata.vacationDays - 1) * 86400000).toLocaleDateString('pt-BR')}</strong>, 
                      devendo retornar ao trabalho no dia <strong>{documentToView.metadata.returnDate}</strong>.
                    </p>

                    {documentToView.metadata.sellDays && (
                      <p className="text-justify indent-8 font-semibold">
                        Neste ato, fica também acordada a conversão de 1/3 (um terço) do período de férias a que tem direito 
                        em abono pecuniário (10 dias).
                      </p>
                    )}

                    <div className="mt-16 pt-8 border-t border-slate-400 text-center space-y-2">
                      <p>Data do ciente: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></p>
                      <p>_________________________________________________</p>
                      <p className="font-bold">{profile?.full_name}</p>
                      <p className="text-sm text-slate-500">CPF: {maskCpf(profile?.cpf || '')}</p>
                    </div>
                  </div>
                )}
                
                {documentToView.document_type === 'VACATION_RECEIPT' && documentToView.metadata && (
                  <div className="space-y-6">
                    <h1 className="text-xl font-bold text-center underline uppercase mb-8">Recibo de Férias</h1>
                    
                    <p>
                      Recebi de minha empregadora, a importância líquida referente às minhas férias do período aquisitivo de 
                      <strong> {new Date(documentToView.metadata.startDate).toLocaleDateString('pt-BR')}</strong>, 
                      com início marcado para <strong>{new Date(documentToView.metadata.startDate).toLocaleDateString('pt-BR')}</strong> e 
                      retorno ao trabalho no dia <strong>{documentToView.metadata.returnDate}</strong>.
                    </p>
                    
                    <div className="mt-16 pt-8 border-t border-slate-400 text-center space-y-2">
                      <p>Data do recibo: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></p>
                      <p>_________________________________________________</p>
                      <p className="font-bold">{profile?.full_name}</p>
                      <p className="text-sm text-slate-500">CPF: {maskCpf(profile?.cpf || '')}</p>
                    </div>
                  </div>
                )}

                {!['VACATION_NOTICE', 'VACATION_RECEIPT'].includes(documentToView.document_type) && (
                  <div className="text-center py-20 text-slate-500">
                    <AlertCircle className="mx-auto mb-4 opacity-50" size={48} />
                    <p>Visualização não disponível para este tipo de documento.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              {documentToView.status === 'PENDING_SIGNATURE' && (
                <button 
                  onClick={() => handleSignDocument(documentToView.id, documentToView.metadata)}
                  disabled={signingDocId === documentToView.id}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {signingDocId === documentToView.id ? <Loader2 size={18} className="animate-spin" /> : <PenTool size={18} />}
                  Assinar Eletronicamente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualização de Férias */}
      <AnimatePresence>
        {showVacationDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-4xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="font-display text-lg font-bold text-slate-800">{vacationDocTitle}</h3>
                <button
                  onClick={() => setShowVacationDoc(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden bg-slate-100 p-2 sm:p-6 relative">
                <iframe 
                  id="vacation-doc-frame"
                  srcDoc={vacationDocHtml}
                  className="w-full h-full bg-white rounded shadow-sm border-0"
                  title="Documento de Férias"
                />
              </div>
              
              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end">
                <button
                  onClick={() => {
                    const iframe = document.getElementById('vacation-doc-frame') as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.print();
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
                >
                  <FileText size={18} />
                  Imprimir Documento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
