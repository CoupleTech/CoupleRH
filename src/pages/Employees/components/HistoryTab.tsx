import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Briefcase, Network } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { format } from "date-fns";
import Movements from "../../Movements";

export default function HistoryTab({ workerId, contractId }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (contractId) {
      fetchHistory();
    }
  }, [contractId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [historyRes, posRes, depRes] = await Promise.all([
        supabase.from("employment_contract_history").select("*").eq("employment_contract_id", contractId),
        supabase.from("positions").select("id, title"),
        supabase.from("departments").select("id, name")
      ]);

      const positions = Object.fromEntries((posRes.data || []).map(p => [p.id, p.title]));
      const departments = Object.fromEntries((depRes.data || []).map(d => [d.id, d.name]));

      let combined: any[] = [];
      
      historyRes.data?.forEach(h => {
        let title = '';
        let desc = '';
        let icon = TrendingUp;

        if (h.event_type === 'SALARY') {
          title = 'Alteração Salarial';
          desc = `Novo salário: R$ ${Number(h.new_value).toFixed(2).replace('.', ',')} - Motivo: ${h.reason}`;
          icon = TrendingUp;
        } else if (h.event_type === 'POSITION') {
          title = 'Mudança de Cargo';
          desc = `Novo cargo: ${positions[h.new_value] || h.new_value} - Motivo: ${h.reason}`;
          icon = Briefcase;
        } else if (h.event_type === 'DEPARTMENT') {
          title = 'Transferência de Setor/Departamento';
          desc = `Novo setor: ${departments[h.new_value] || h.new_value} - Motivo: ${h.reason}`;
          icon = Network;
        } else {
          title = 'Movimentação (' + h.event_type + ')';
          desc = `Novo valor: ${h.new_value} - Motivo: ${h.reason}`;
          icon = TrendingUp;
        }

        combined.push({
          id: h.id,
          type: h.event_type,
          title,
          desc,
          date: h.event_date,
          created_at: h.created_at,
          icon
        });
      });

      // Ordenar por data mais recente
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistory(combined);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!contractId) {
    return (
      <div className="card p-8 text-center text-slate-500">
        Você precisa cadastrar o <strong>Contrato de Trabalho</strong> primeiro para que o histórico funcional seja ativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isAdding ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Linha do Tempo Funcional</h2>
            <button 
              onClick={() => setIsAdding(true)} 
              className="btn-primary text-sm py-1.5 px-3"
            >
              Registrar Alteração
            </button>
          </div>

          <div className="card p-6">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center p-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                Nenhum registro no histórico deste colaborador ainda.
              </div>
            ) : (
              <div className="relative border-l border-slate-200 ml-3 space-y-8">
                {history.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={`${item.type}-${item.id}`} className="relative pl-6">
                      {/* Ponto na timeline */}
                      <div className="absolute w-6 h-6 bg-white border border-slate-200 rounded-full -left-3 top-0 flex items-center justify-center shadow-sm">
                        <Icon size={12} className="text-slate-500" />
                      </div>
                      
                      {/* Conteúdo */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 -mt-2">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                          <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                            {format(new Date(item.date), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                        <p className="text-[10px] text-slate-400 mt-2">
                          Registrado no sistema em {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card p-6 border-l-4 border-l-primary-500">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-4 border-b border-slate-100">Registrar Nova Movimentação</h2>
          <Movements 
            inline 
            preselectedContractId={contractId} 
            onSaved={() => {
              setIsAdding(false);
              fetchHistory();
            }}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      )}
    </div>
  );
}
