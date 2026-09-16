import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Building2,
  Loader2,
  MoreVertical,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface Company {
  id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
  tax_regime: string | null;
  primary_cnae: string | null;
  status: string;
}

export default function CompaniesList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, corporate_name, trade_name, cnpj, tax_regime, primary_cnae, status")
      .order("corporate_name", { ascending: true });

    if (!error && data) {
      setCompanies(data as Company[]);
    }
    setLoading(false);
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.corporate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm),
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Empresas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as empresas e filiais cadastradas no tenant
          </p>
        </div>

        <button
          onClick={() => navigate("/empresas/nova")}
          className="btn-primary"
        >
          <Plus size={16} />
          <span>Nova Empresa</span>
        </button>
      </div>

      <div className="panel-flush">
        {/* Search toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header px-6 py-3.5">Empresa</th>
                <th className="table-header px-6 py-3.5">CNPJ</th>
                <th className="table-header px-6 py-3.5">Regime Tributário</th>
                <th className="table-header px-6 py-3.5">CNAE</th>
                <th className="table-header px-6 py-3.5">Status</th>
                <th className="table-header px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary-500 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      Carregando empresas...
                    </p>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <Building2
                      size={32}
                      className="text-slate-200 mx-auto mb-3"
                    />
                    <p className="text-sm text-slate-500 font-medium">
                      Nenhuma empresa encontrada
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Cadastre sua primeira empresa para começar
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="table-row group cursor-pointer"
                    onClick={() => navigate(`/empresas/${company.id}`)}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                            {company.corporate_name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {company.trade_name || "Sem nome fantasia"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-sm text-slate-600 tabular-nums">
                        {company.cnpj}
                      </span>
                    </td>
                    <td className="table-cell">
                      {company.tax_regime ? (
                        <span className="badge-neutral">
                          {company.tax_regime}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="table-cell text-slate-600 text-sm">
                      {company.primary_cnae || <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                        company.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        company.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {company.status === 'ACTIVE' ? 'Ativo' : company.status === 'SUSPENDED' ? 'Suspenso' : 'Inativo'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <button className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
