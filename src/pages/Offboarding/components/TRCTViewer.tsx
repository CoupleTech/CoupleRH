import { X, Printer, Calculator, DollarSign, Percent, FileText } from "lucide-react";

interface TRCTViewerProps {
  termination: any; // O registro da tabela terminations que contém o calculated_trct
  onClose: () => void;
}

export default function TRCTViewer({ termination, onClose }: TRCTViewerProps) {
  const trctResult = termination.calculated_trct;
  const contract = termination.employment_contracts;
  const workerName = contract?.workers?.people?.full_name || "Desconhecido";
  const workerCpf = contract?.workers?.people?.cpf || "Não informado";
  const baseSalary = contract?.base_salary || 0;
  const companyName = contract?.companies?.corporate_name || "Desconhecida";
  const companyCnpj = contract?.companies?.cnpj || "Não informado";

  const handlePrint = () => {
    window.print();
  };

  if (!trctResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <p className="text-slate-600 mb-6">Nenhum cálculo de TRCT encontrado para este desligamento.</p>
          <button onClick={onClose} className="btn-primary w-full">Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:block">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] print:shadow-none print:max-w-full print:max-h-none print:rounded-none">
        {/* Header - Hidden on print */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                Termo de Rescisão do Contrato de Trabalho
              </h3>
              <p className="text-xs text-slate-400">
                Visualização e Impressão (TRCT Digital)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <Printer size={16} /> Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable on screen, full height on print */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white print:p-0 print:overflow-visible">
          
          {/* Document Header for Print */}
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">Termo de Rescisão do Contrato de Trabalho</h1>
            <h2 className="text-md font-semibold text-slate-600 mt-1">TRCT Digital</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-4 border border-slate-300 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Dados do Empregador</h3>
              <p className="font-semibold text-slate-900">{companyName}</p>
              <p className="text-sm text-slate-600 mt-1">CNPJ: {companyCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</p>
            </div>
            <div className="p-4 border border-slate-300 rounded-lg">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Dados do Trabalhador</h3>
              <p className="font-semibold text-slate-900">{workerName}</p>
              <p className="text-sm text-slate-600 mt-1">
                CPF: {workerCpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Data de Afastamento: {new Date(termination.last_working_day).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="block text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">Causa do Afastamento</span>
                <span className="font-bold text-slate-800">{termination.termination_reason || 'Não informada'}</span>
              </div>
              <div>
                <span className="block text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">Tipo de Aviso Prévio</span>
                <span className="font-bold text-slate-800">{termination.notice_period_type || 'Não informado'}</span>
              </div>
              <div>
                <span className="block text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">Salário Base</span>
                <span className="font-bold text-slate-800">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(baseSalary)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3 text-sm uppercase tracking-wider">
                Verbas Rescisórias (Proventos)
              </h4>
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600 border border-slate-300">Rubrica / Descrição</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600 border border-slate-300 w-32">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 text-slate-700">
                      Saldo de Salário ({trctResult.proventos.saldoSalario.dias || 0} dias)
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.saldoSalario.valor || 0)}
                    </td>
                  </tr>
                  {trctResult.proventos.avisoIndenizado?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">
                        Aviso Prévio Indenizado ({trctResult.proventos.avisoIndenizado.dias} dias)
                      </td>
                      <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.avisoIndenizado.valor)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 text-slate-700">
                      13º Salário Proporcional ({trctResult.proventos.decimoTerceiro.avos || 0}/12)
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.decimoTerceiro.valor || 0)}
                    </td>
                  </tr>
                  {trctResult.proventos.decimoTerceiroAviso?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">
                        13º s/ Aviso Indenizado ({trctResult.proventos.decimoTerceiroAviso.avos}/12)
                      </td>
                      <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.decimoTerceiroAviso.valor)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 text-slate-700">
                      Férias Proporcionais ({trctResult.proventos.feriasProporcionais.avos || 0}/12)
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.feriasProporcionais.valor || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 text-slate-700">
                      1/3 de Férias
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.proventos.umTercoFerias.valor || 0)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 font-bold text-slate-900 bg-slate-50 text-right">
                      Total Bruto (Proventos)
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-bold text-slate-900 bg-slate-50 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.totais.bruto || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3 mt-6 text-sm uppercase tracking-wider">
                Deduções (Descontos)
              </h4>
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600 border border-slate-300">Rubrica / Descrição</th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600 border border-slate-300 w-32">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {trctResult.descontos.inssSaldo?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">INSS s/ Saldo de Salário</td>
                      <td className="px-4 py-2 text-right border border-slate-300 text-rose-700 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.descontos.inssSaldo.valor)}
                      </td>
                    </tr>
                  ) : null}
                  {trctResult.descontos.inssDecimo?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">INSS s/ 13º Salário</td>
                      <td className="px-4 py-2 text-right border border-slate-300 text-rose-700 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.descontos.inssDecimo.valor)}
                      </td>
                    </tr>
                  ) : null}
                  {trctResult.descontos.irrf?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">IRRF s/ Verbas</td>
                      <td className="px-4 py-2 text-right border border-slate-300 text-rose-700 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.descontos.irrf.valor)}
                      </td>
                    </tr>
                  ) : null}
                  {trctResult.descontos.avisoDescontado?.valor ? (
                    <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-700">Desconto Aviso Prévio Não Cumprido</td>
                      <td className="px-4 py-2 text-right border border-slate-300 text-rose-700 font-mono">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.descontos.avisoDescontado.valor)}
                      </td>
                    </tr>
                  ) : null}
                  {Object.keys(trctResult.descontos).length === 0 || (!trctResult.descontos.inssSaldo?.valor && !trctResult.descontos.inssDecimo?.valor && !trctResult.descontos.irrf?.valor && !trctResult.descontos.avisoDescontado?.valor) ? (
                     <tr>
                      <td className="px-4 py-2 border border-slate-300 text-slate-500 italic" colSpan={2}>Nenhum desconto aplicado.</td>
                     </tr>
                  ): null}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-4 py-2 border border-slate-300 font-bold text-slate-900 bg-slate-50 text-right">
                      Total de Descontos
                    </td>
                    <td className="px-4 py-2 text-right border border-slate-300 font-bold text-rose-700 bg-slate-50 font-mono">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.totais.descontos || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-8 border-2 border-slate-900 rounded-xl overflow-hidden print:border-slate-500">
               <div className="bg-slate-100 p-4 flex justify-between items-center print:bg-white print:border-b print:border-slate-500">
                  <span className="font-bold text-lg uppercase">Valor Líquido da Rescisão</span>
                  <span className="font-black text-2xl font-mono text-emerald-700 print:text-slate-900">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.totais.liquido || 0)}
                  </span>
               </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-300">
              <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">
                Informações de FGTS (Mês da Rescisão e Multa Rescisória)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 border border-slate-200 rounded">
                     <p className="text-xs text-slate-500 mb-1">Mês da Rescisão</p>
                     <p className="font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.encargos.fgtsMes || 0)}</p>
                  </div>
                  <div className="p-3 border border-slate-200 rounded">
                     <p className="text-xs text-slate-500 mb-1">Sobre 13º Salário</p>
                     <p className="font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.encargos.fgtsDecimo || 0)}</p>
                  </div>
                  <div className="p-3 border border-slate-200 rounded bg-blue-50/50">
                     <p className="text-xs text-blue-800 mb-1 font-bold">Multa Rescisória (GRRF)</p>
                     <p className="font-black text-blue-900">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trctResult.encargos.multaFGTS || 0)}</p>
                  </div>
              </div>
            </div>

            {/* Assinaturas */}
            <div className="mt-16 pt-8 grid grid-cols-2 gap-12">
               <div className="text-center">
                  <div className="border-t border-slate-900 w-full mb-2 pt-2"></div>
                  <p className="font-bold text-sm text-slate-800">Empregador</p>
                  <p className="text-xs text-slate-500">{companyName}</p>
               </div>
               <div className="text-center">
                  <div className="border-t border-slate-900 w-full mb-2 pt-2"></div>
                  <p className="font-bold text-sm text-slate-800">Trabalhador</p>
                  <p className="text-xs text-slate-500">{workerName}</p>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
