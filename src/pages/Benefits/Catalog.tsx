import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Briefcase,
  HeartPulse,
  Bus,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface Benefit {
  id: string;
  name: string;
  benefit_type: string;
  provider_name: string | null;
  company_contribution: number;
  employee_discount_percentage: number | null;
  employee_discount_fixed: number | null;
  is_active: boolean;
}

export default function BenefitsCatalog() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("benefit_catalogs")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      setBenefits(data as any);
    }
    setLoading(false);
  };

  const getIcon = (type: string) => {
    if (type === "TRANSPORTATION")
      return <Bus size={24} className="text-slate-700" />;
    if (type === "HEALTH_INSURANCE")
      return <HeartPulse size={24} className="text-rose-600" />;
    if (type === "DENTAL_INSURANCE")
      return <HeartPulse size={24} className="text-blue-600" />;
    if (type === "MEAL" || type === "FOOD")
      return <Briefcase size={24} className="text-amber-600" />;
    return <Briefcase size={24} className="text-slate-500" />;
  };

  const getDiscountDisplay = (ben: Benefit) => {
    if (ben.employee_discount_percentage)
      return `${ben.employee_discount_percentage}%`;
    if (ben.employee_discount_fixed)
      return `R$ ${ben.employee_discount_fixed.toFixed(2).replace(".", ",")}`;
    return "Sem Desconto";
  };

  const getCompanyCostDisplay = (ben: Benefit) => {
    if (ben.company_contribution > 0)
      return `R$ ${ben.company_contribution.toFixed(2).replace(".", ",")}`;
    return "Variável";
  };

  const filteredBenefits = benefits.filter((ben) =>
    ben.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Catálogo de Benefícios
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os benefícios oferecidos e as regras de desconto em folha
          </p>
        </div>

        <button
          onClick={() => navigate("/beneficios/novo")}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Benefício</span>
        </button>
      </div>

      <div className="mb-6 relative w-full md:w-96">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar benefício..."
          className="input pl-10 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-2" />
        </div>
      ) : filteredBenefits.length === 0 ? (
        <div className="text-center py-20 text-slate-500 font-bold bg-white border border-slate-200 rounded-lg shadow-sm">
          Nenhum benefício encontrado no catálogo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBenefits.map((ben) => (
            <div
              key={ben.id}
              className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-primary-500/30 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {getIcon(ben.benefit_type)}
                </div>
                {ben.is_active ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-600 border border-slate-200">
                    Inativo
                  </span>
                )}
              </div>

              <h3 className="font-bold text-slate-900 text-lg mb-1 font-display">
                {ben.name}
              </h3>
              {ben.provider_name && (
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-4">
                  {ben.provider_name}
                </p>
              )}

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">
                    Desconto (Funcionário):
                  </span>
                  <span className="font-bold text-slate-800">
                    {getDiscountDisplay(ben)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Custo (Empresa):</span>
                  <span className="font-bold text-slate-800">
                    {getCompanyCostDisplay(ben)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
