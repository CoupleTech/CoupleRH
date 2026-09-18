import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Calculator, Calendar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Pagination } from '../../../components/Pagination';

interface LegalVersion {
  id: string;
  version_name: string;
  valid_from: string;
  valid_to: string | null;
  source: string;
}

export default function LegalTablesList() {
  const [versions, setVersions] = useState<LegalVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchVersions();
  }, []);

  async function fetchVersions() {
    try {
      const { data, error } = await supabase
        .from('legal_versions')
        .select('*')
        .order('valid_from', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error fetching legal versions:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-2">
            <Calculator className="text-primary-500" />
            Parâmetros Legais
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de versões de tabelas INSS, IRRF, FGTS e outros parâmetros CLT
          </p>
        </div>
        <Link to="/configuracoes/tabelas-legais/nova" className="btn-primary">
          <Plus size={18} />
          <span>Nova Versão</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar versão legal..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 rounded-lg border border-slate-200">
            <Calculator size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhuma versão cadastrada</h3>
            <p className="text-slate-500 mt-2 mb-6">Comece cadastrando os parâmetros de 2026.</p>
            <Link to="/configuracoes/tabelas-legais/nova" className="btn-primary inline-flex">
              <Plus size={18} />
              <span>Cadastrar Versão</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="px-6 py-4">Versão</th>
                  <th className="px-6 py-4">Vigência</th>
                  <th className="px-6 py-4">Fonte</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {versions.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((version) => (
                  <tr key={version.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{version.version_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(version.valid_from).toLocaleDateString('pt-BR')} 
                        {version.valid_to ? ` até ${new Date(version.valid_to).toLocaleDateString('pt-BR')}` : ' em diante'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {version.source || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/configuracoes/tabelas-legais/${version.id}`}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!loading && versions.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(versions.length / pageSize)}
            pageSize={pageSize}
            totalItems={versions.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
