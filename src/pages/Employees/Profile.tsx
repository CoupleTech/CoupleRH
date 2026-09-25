import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft,
  Loader2,
  User,
  Briefcase,
  History,
  ShieldAlert,
  Users,
  Calendar,
  Activity,
  Clock
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";

// Mock tabs for now
import PersonalDataTab from "./components/PersonalDataTab";
import ContractTab from "./components/ContractTab";
import HistoryTab from "./components/HistoryTab";
import DependentsTab from "./components/DependentsTab";
import VacationsTab from "./components/VacationsTab";
import LeavesTab from "./components/LeavesTab";
import ScaleTab from "./components/ScaleTab";
import ContactsTab from "./components/ContactsTab";
import BankingDataTab from "./components/BankingDataTab";
import DocumentsTab from "./components/DocumentsTab";

// Importando os componentes funcionais reais (criados nas Fases 10 e 11)
import EmployeeBenefitsTab from "../EmployeeBenefitsTab";
import EmployeeDeductionsTab from "../EmployeeDeductionsTab";
import EmployeeFixedEventsTab from "../EmployeeFixedEventsTab";
import SalaryAdjustmentsTab from "./components/SalaryAdjustmentsTab";
import { Receipt, Gift, TrendingUp, DollarSign, Phone, Building, FileText, Save, Check } from "lucide-react";

const TABS = [
  { id: 'personal', label: 'Dados Pessoais', icon: User },
  { id: 'contacts', label: 'Contatos', icon: Phone },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'contract', label: 'Contrato e Vínculo', icon: Briefcase },
  { id: 'scale', label: 'Escalas e Jornada', icon: Clock },
  { id: 'history', label: 'Histórico Funcional', icon: History },
  { id: 'salary_adjustments', label: 'Reajustes / Dissídio', icon: DollarSign },
  { id: 'dependents', label: 'Dependentes', icon: Users },
  { id: 'benefits', label: 'Benefícios', icon: Gift },
  { id: 'fixed_events', label: 'Adicionais / Fixos', icon: TrendingUp },
  { id: 'deductions', label: 'Descontos / Retenções', icon: Receipt },
  { id: 'banking', label: 'Dados Bancários', icon: Building },
  { id: 'vacations', label: 'Férias', icon: Calendar },
  { id: 'leaves', label: 'Afastamentos', icon: Activity },
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id && id !== 'novo');
  
  const [workerData, setWorkerData] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveIndicator = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleGenericSave = () => {
    handleSaveIndicator();
    fetchEmployee();
  };

  const { selectedCompanyId } = useCompany();
  const prevCompanyIdRef = useRef(selectedCompanyId);

  useEffect(() => {
    if (id && id !== 'novo') {
      fetchEmployee();
    } else {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    // Se a empresa for alterada enquanto visualiza um funcionário existente,
    // volta para a lista, pois o contexto mudou.
    if (prevCompanyIdRef.current && prevCompanyIdRef.current !== selectedCompanyId && id !== 'novo') {
      navigate('/funcionarios');
    }
    prevCompanyIdRef.current = selectedCompanyId;
  }, [selectedCompanyId, id, navigate]);

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          people (*),
          employment_contracts (
            *,
            employee_scales (*),
            companies (*),
            positions (*),
            departments (*)
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setWorkerData(data);
    } catch (error) {
      console.error("Erro ao buscar funcionário", error);
    } finally {
      setFetching(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const isNew = id === 'novo';
  const personName = workerData?.people?.social_name || workerData?.people?.full_name || "Novo Empregado";

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header Profile */}
      <div className="card p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row items-start md:items-center gap-6">
        <button 
          onClick={() => navigate('/funcionarios')}
          className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white border-2 border-white/20">
            {isNew ? 'N' : personName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-white mb-1">
              {personName}
            </h1>
            <p className="text-slate-300 text-sm">
              {isNew ? 'Preencha os dados civis e contratuais.' : `Matrícula: ${workerData?.esocial_matricula || 'Pendente'}`}
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row gap-3 items-center">
          <button 
            type="button"
            onClick={() => {
              const form = document.querySelector(`#tab-content-${activeTab} form`) as HTMLFormElement;
              if (form) {
                form.requestSubmit();
              } else {
                console.warn('Nenhum formulário encontrado na aba atual.');
              }
            }}
            className={`w-full sm:w-auto btn-primary border-none px-6 shadow-md shadow-black/20 transition-colors duration-300 ${
              isSaved 
                ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            <span>{isSaved ? 'Salvo com sucesso!' : 'Salvar Aba Atual'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Menu Lateral (Tabs) */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 bg-white p-2 rounded-xl shadow-sm border border-slate-200 sticky top-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={isNew && tab.id !== 'personal'} // Só libera as outras abas após salvar a pessoa
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium outline-none w-full text-left
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  ${isNew && tab.id !== 'personal' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <Icon size={18} className={isActive ? 'text-primary-600' : 'text-slate-400 shrink-0'} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
        <div id="tab-content-personal" className={activeTab === 'personal' ? 'block' : 'hidden'}>
          <PersonalDataTab 
            workerId={isNew ? null : id}
            initialData={workerData?.people} 
            onSaved={(newWorkerId: string) => {
              handleSaveIndicator();
              if (isNew) navigate(`/funcionarios/${newWorkerId}`);
              else fetchEmployee();
            }} 
          />
        </div>

        <div id="tab-content-contacts" className={activeTab === 'contacts' ? 'block' : 'hidden'}>
          <ContactsTab 
            workerId={id || null}
            initialData={workerData?.people} 
            onSaved={handleGenericSave}
          />
        </div>

        <div id="tab-content-documents" className={activeTab === 'documents' ? 'block' : 'hidden'}>
          <DocumentsTab 
            workerId={id || null}
            onSaved={handleGenericSave}
          />
        </div>
        
        <div id="tab-content-contract" className={activeTab === 'contract' ? 'block' : 'hidden'}>
          <ContractTab 
            workerId={id || null} 
            contracts={workerData?.employment_contracts || []}
            onSaved={handleGenericSave}
          />
        </div>

        <div id="tab-content-scale" className={activeTab === 'scale' ? 'block' : 'hidden'}>
          <ScaleTab 
            contractId={workerData?.employment_contracts?.[0]?.id}
            scales={workerData?.employment_contracts?.[0]?.employee_scales || []}
            onSaved={handleGenericSave}
          />
        </div>
        
        <div id="tab-content-history" className={activeTab === 'history' ? 'block' : 'hidden'}>
          <HistoryTab 
            workerId={id || null} 
            contractId={workerData?.employment_contracts?.[0]?.id}
          />
        </div>

        <div id="tab-content-salary_adjustments" className={activeTab === 'salary_adjustments' ? 'block' : 'hidden'}>
          <SalaryAdjustmentsTab 
            contractId={workerData?.employment_contracts?.[0]?.id} 
            onSaved={handleGenericSave}
          />
        </div>

        <div id="tab-content-dependents" className={activeTab === 'dependents' ? 'block' : 'hidden'}>
          <DependentsTab 
            workerId={id !== 'novo' ? id : null} 
            onSaved={handleGenericSave} 
          />
        </div>
        
        <div id="tab-content-benefits" className={activeTab === 'benefits' ? 'block' : 'hidden'}>
          <EmployeeBenefitsTab contractId={workerData?.employment_contracts?.[0]?.id} />
        </div>

        <div id="tab-content-fixed_events" className={activeTab === 'fixed_events' ? 'block' : 'hidden'}>
          <EmployeeFixedEventsTab contractId={workerData?.employment_contracts?.[0]?.id} />
        </div>

        <div id="tab-content-deductions" className={activeTab === 'deductions' ? 'block' : 'hidden'}>
          <EmployeeDeductionsTab contractId={workerData?.employment_contracts?.[0]?.id} />
        </div>

        <div id="tab-content-banking" className={activeTab === 'banking' ? 'block' : 'hidden'}>
          <BankingDataTab 
            workerId={id || null}
            initialData={workerData}
            onSaved={handleGenericSave}
          />
        </div>

        <div id="tab-content-vacations" className={activeTab === 'vacations' ? 'block' : 'hidden'}>
          <VacationsTab 
            workerId={id || null} 
            contract={workerData?.employment_contracts?.[0]}
            workerData={workerData}
            onSaved={handleGenericSave}
          />
        </div>

        <div id="tab-content-leaves" className={activeTab === 'leaves' ? 'block' : 'hidden'}>
          <LeavesTab employee={workerData} />
        </div>
      </div>
      </div>
    </div>
  );
}
