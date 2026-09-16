import { ShieldAlert, Package, Calendar, Settings2 } from "lucide-react";

export default function BenefitsTab() {
  return (
    <div className="space-y-6">
      <div className="card p-8 text-center border-2 border-dashed border-primary-200 bg-primary-50/50">
        <div className="mx-auto w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-primary-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Gestão de Benefícios (Fase 10)</h2>
        <p className="text-slate-600 max-w-lg mx-auto mb-6">
          Você tem uma visão incrível do sistema! O fluxo de Vale Transporte rígido não é o padrão final. 
          Na <strong>Fase 10</strong>, construiremos o Catálogo de Benefícios (VT, VR, VA, Plano de Saúde, Odonto, Gympass).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <Settings2 className="w-5 h-5 text-slate-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Catálogo Dinâmico</h3>
            <p className="text-xs text-slate-500">Benefícios criados de forma global na empresa para serem distribuídos.</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <ShieldAlert className="w-5 h-5 text-slate-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Vínculo Flexível</h3>
            <p className="text-xs text-slate-500">Selecione e vincule qualquer benefício ao colaborador com regras próprias.</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <Calendar className="w-5 h-5 text-slate-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Controle de Vigência</h3>
            <p className="text-xs text-slate-500">Defina data de início e fim. O sistema saberá exatamente quando parar de descontar na folha.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
