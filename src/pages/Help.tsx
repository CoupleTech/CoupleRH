import { useState } from 'react';
import { 
  BookOpen, Building2, Users, CalendarDays, Calculator, 
  ShieldCheck, Activity, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';

type Category = 'basicos' | 'colaboradores' | 'ponto' | 'rotinas' | 'motor' | 'conformidade';

const CATEGORIES: { id: Category; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'basicos', label: 'Cadastros Fundamentais', icon: Building2, desc: 'Empresas, Lotações, Cargos e Estrutura.' },
  { id: 'colaboradores', label: 'Colaboradores (Perfil 360º)', icon: Users, desc: 'Admissão, Dependentes, Contratos e Histórico.' },
  { id: 'ponto', label: 'Jornada, Ponto e Escalas', icon: CalendarDays, desc: 'Feriados, Cargas Horárias e Espelho.' },
  { id: 'rotinas', label: 'Rotinas de DP', icon: Activity, desc: 'Férias, Afastamentos e Desligamentos.' },
  { id: 'motor', label: 'Motor e Folha', icon: Calculator, desc: 'Processamento, Rubricas, Complementar e Dissídio.' },
  { id: 'conformidade', label: 'Sistema e Conformidade', icon: ShieldCheck, desc: 'Auditoria, eSocial, Cofre Digital.' },
];

export default function Help() {
  const [activeCategory, setActiveCategory] = useState<Category>('basicos');

  const renderContent = () => {
    switch (activeCategory) {
      case 'basicos':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Cadastros Fundamentais</h2>
              <p className="text-slate-600">A base do sistema coupleRH. Lembre-se do princípio: <strong>Cadastro define a realidade.</strong> Se a fundação estiver correta, a folha será calculada com precisão.</p>
            </div>

            <div className="space-y-6">
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                  <Building2 size={20} className="text-primary-500" />
                  Empresas e Matriz
                </h3>
                <p className="text-slate-600 text-sm mb-3">Tudo no coupleRH é isolado por Empresa (Tenant). O cálculo de encargos patronais depende estritamente do enquadramento tributário (Simples Nacional, Lucro Real) cadastrado no perfil da empresa.</p>
                <ul className="list-none space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2 items-start"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" /> Acesse <strong>Principal {'>'} Empresas</strong> para editar ou criar novas empresas filiais.</li>
                  <li className="flex gap-2 items-start"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" /> Utilize o seletor no topo direito da tela para alternar entre as empresas. Os dados são estritamente isolados por RLS no banco de dados.</li>
                </ul>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-primary-500" />
                  Estrutura Organizacional e Centros de Custo
                </h3>
                <p className="text-slate-600 text-sm mb-3">A hierarquia contábil e administrativa permite a geração de relatórios rateados.</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                  <li><strong>Departamentos e Setores:</strong> Organizam os colaboradores de forma hierárquica (ex: Diretoria Administrativa {'>'} Setor Financeiro).</li>
                  <li><strong>Centros de Custo:</strong> Essenciais para a contabilização da folha. Ao lançar a folha, o Motor divide o custo patronal pelo CC alocado.</li>
                </ul>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-primary-500" />
                  Cargos, CBO e Lotações Tributárias
                </h3>
                <p className="text-slate-600 text-sm mb-3">Antes de admitir qualquer funcionário, estes três cadastros devem estar concluídos:</p>
                <div className="grid grid-cols-1 gap-4 text-sm text-slate-600">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong className="text-slate-800">Cargos:</strong> Vinculados à tabela do eSocial. Exigem o código CBO correto.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong className="text-slate-800">Tipos de Contrato:</strong> O motor identifica se a pessoa é Celetista, Estagiário ou Autônomo e adapta as deduções tributárias.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong className="text-slate-800">Lotações Tributárias (Locais):</strong> Define onde o trabalhador presta serviço (FPAS, Código de Terceiros). Crítico para o S-1020 do eSocial.
                  </div>
                </div>
              </section>
            </div>
          </div>
        );

      case 'colaboradores':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Colaboradores (Perfil 360º)</h2>
              <p className="text-slate-600">Acesse <strong>Organização {'>'} Colaboradores</strong>. A visão do colaborador é dividida em várias abas detalhadas. Aqui você realiza admissões, alterações salariais e cadastro de regras individuais.</p>
            </div>

            <div className="space-y-4">
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">1. Dados Pessoais, Contatos e Documentos</h3>
                <p className="text-sm text-slate-600 mb-2">Mantém a conformidade cadastral (S-2200). Validação estrita de CPF obrigatória. Endereço é utilizado para o cálculo automático do Vale Transporte.</p>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-primary-500">
                <h3 className="font-bold text-slate-800 mb-2">2. Contrato de Trabalho</h3>
                <p className="text-sm text-slate-600 mb-2">O coração da admissão. Aqui você define o Cargo, Salário Base Mensal/Horista, Jornada de Trabalho e Lotação. Qualquer alteração aqui reflete instantaneamente no próximo processamento do Motor.</p>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">3. Dependentes (IRRF e Salário-Família)</h3>
                <p className="text-sm text-slate-600 mb-2">Para cada dependente (filhos, enteados, cônjuge), você deve sinalizar dois switches importantes:</p>
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                  <li><strong>Abater IRRF:</strong> Se ativo, o Motor reduzirá a base de cálculo do Imposto de Renda.</li>
                  <li><strong>Salário-Família:</strong> Se ativo e o salário enquadrar no teto legal, injeta o provento no holerite.</li>
                </ul>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">4. Eventos Fixos e Benefícios</h3>
                <p className="text-sm text-slate-600 mb-2">Se o funcionário possui desconto de pensão alimentícia ou recebe quebra de caixa todo mês, cadastre na aba de <strong>Eventos Fixos</strong>. O Motor sempre os injetará automaticamente na folha.</p>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
                <h3 className="font-bold text-slate-800 mb-2">5. Reajustes / Dissídio Mágico</h3>
                <p className="text-sm text-slate-600 mb-2">Na aba de Dissídio, ao clicar em "Novo Reajuste":</p>
                <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
                  <li>Informe o valor em percentual ou monetário e a data efetiva (Data-Base).</li>
                  <li>Se a data for retroativa (meses passados que já tiveram a folha fechada), o coupleRH usará sua <strong>Inteligência de Diferenças</strong>.</li>
                  <li>O sistema atualizará o salário atual e <strong>gerará silenciosamente competências do tipo Complementar</strong> aguardando processamento na tela da Folha. Sem planilhas, sem dor de cabeça!</li>
                </ol>
              </section>
            </div>
          </div>
        );

      case 'ponto':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Jornada, Ponto e Escalas</h2>
              <p className="text-slate-600">A relação entre o relógio de ponto e a conversão matemática da folha.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Jornadas e Cargas</h3>
                <p className="text-sm text-slate-600 mb-2">Vá em <strong>Ponto e Escalas {'>'} Jornadas</strong>.</p>
                <p className="text-sm text-slate-600">Define o divisor salarial padrão. Se a jornada for 220h (padrão CLT), o sistema pega o salário mensal base, divide por 220 para descobrir o valor da hora e aplicar 50% nas horas extras. Fator crítico para o motor.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Feriados</h3>
                <p className="text-sm text-slate-600 mb-2">Vá em <strong>Ponto e Escalas {'>'} Feriados</strong>.</p>
                <p className="text-sm text-slate-600">A contabilização do DSR (Descanso Semanal Remunerado) sobre horas extras, que ocorre no processamento da folha, verifica automaticamente a tabela de feriados vinculada ao estado/município do funcionário.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Espelho de Ponto (Timesheet)</h3>
                <p className="text-sm text-slate-600 mb-2">Tela dedicada a visualizar e ajustar (apontamento de exceções) o espelho do mês do trabalhador.</p>
                <p className="text-sm text-slate-600"><strong>Dica de uso:</strong> As Horas Extras a 50%, Adicional Noturno e Faltas (em dias e horas) exportadas do relógio de ponto devem ser enviadas diretamente para a tela de Lançamentos Variáveis da folha para serem monetizadas.</p>
              </div>
            </div>
          </div>
        );

      case 'rotinas':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Rotinas de DP Avançadas</h2>
              <p className="text-slate-600">Férias, Afastamentos e Rescisões. O coupleRH utiliza Wizards interativos para prevenir erros antes da geração dos eventos do eSocial.</p>
            </div>

            <div className="space-y-6">
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-primary-500">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CalendarDays size={20} className="text-primary-500" />
                  Fluxo de Férias (Wizard)
                </h3>
                <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-600">
                  <li>Acesse <strong>Gestão e Rotinas {'>'} Férias</strong>. A aba <strong>Períodos Aquisitivos</strong> exibe de forma imediata o saldo de férias de toda a empresa. Não é necessário calcular!</li>
                  <li>Clique em <strong>+ Programar Férias</strong>.</li>
                  <li><strong>Passo 1:</strong> Selecione o funcionário e o período aquisitivo (vencido ou proporcional).</li>
                  <li><strong>Passo 2:</strong> Defina os dias de gozo (ex: 20 ou 30). Escolha se haverá <strong>Abono Pecuniário (venda de 1/3)</strong> e a data que as férias iniciarão.</li>
                  <li><strong>Passo 3:</strong> Resumo. Marque a checkbox de <strong>"Gerar Recibo de Férias Imediatamente"</strong> e salve.</li>
                  <li><strong>A Mágica:</strong> O Motor de Cálculo rodará invisivelmente, criará o holerite de férias no módulo da folha com os eventos corretos (Férias Proporcionais, 1/3 Constitucional, Adiantamento, INSS, IRRF) e deduzirá esses dias da folha mensal corrente!</li>
                </ol>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-amber-500" />
                  Desligamentos e TRCT
                </h3>
                <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-600">
                  <li>Acesse <strong>Organização {'>'} Desligamentos</strong> e clique em <strong>+ Novo Desligamento</strong>.</li>
                  <li>Selecione o Motivo (Sem Justa Causa, Pedido, etc) — o sistema bloqueia os campos legais adequados ao motivo.</li>
                  <li>Defina o formato do <strong>Aviso Prévio</strong> (Indenizado ou Trabalhado).</li>
                  <li>Ao ir para a última etapa, o Motor processará o <strong>Termo de Rescisão (TRCT) Simulado</strong>. Verifique os dias trabalhados, 13º proporcional, Férias Vencidas+Proporcionais, multa do FGTS.</li>
                  <li>Ao confirmar, o status do funcionário mudará permanentemente para `TERMINATED` e o TRCT receberá um *snapshot* imutável no banco. O funcionário deixará de rodar na Folha Mensal automática.</li>
                </ol>
              </section>
            </div>
          </div>
        );

      case 'motor':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Motor de Cálculo e Folha</h2>
              <p className="text-slate-600">O núcleo de engenharia pesada do sistema. Nenhuma regra legal (INSS, IRRF) existe no Frontend; todas estão protegidas no servidor.</p>
            </div>

            <div className="space-y-6">
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Lançamentos Variáveis</h3>
                <p className="text-sm text-slate-600 mb-2">Acesse <strong>Ponto e Folha {'>'} Lançamentos Variáveis</strong>. Aqui você deve importar ou preencher as horas extras, descontos por atraso, ajuda de custo (não incidente) para cada contrato no mês vigente. O motor olhará para esta tabela ao processar.</p>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-primary-500">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Processamento da Folha</h3>
                <p className="text-sm text-slate-600 mb-3">Vá em <strong>Motor de Cálculo</strong>.</p>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                  <li>Selecione o Período. O status inicial é "Aberto".</li>
                  <li>Clique em <strong>Processar Tudo</strong>.</li>
                  <li>O backend fará o cálculo individual de todos os funcionários, respeitando faltas, lendo os dependentes para baixar o IRRF simplificado ou padrão (o que for mais benéfico ao funcionário), calculando DSR, calculando o teto do INSS e gerando bases para FGTS.</li>
                  <li>Se houver erro, os Logs aparecerão. Se sucesso, o botão "Fechar Folha" será habilitado. Uma folha fechada <strong>não pode mais ser alterada</strong>.</li>
                </ol>
              </section>

              <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Folha Complementar Mágica</h3>
                  <p className="text-sm text-slate-600 mb-3">Após fechar uma folha mensal, e descobrir depois que o sindicato aprovou o Dissídio ou o funcionário esqueceu de mandar uma hora extra:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
                    <li>Clique em <strong>+ Complementar</strong> na tela do Motor.</li>
                    <li>Vincule a folha original (Fechada).</li>
                    <li>O Motor <strong>simula 100% da nova realidade</strong>, cruza contra o que já foi pago no banco, e cria o recibo complementar exibindo apenas a diferença! Os impostos são calculados apenas sobre o Delta.</li>
                  </ul>
                </section>

                <section className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 text-emerald-600">Memória de Cálculo (Auditoria Máxima)</h3>
                  <p className="text-sm text-slate-600 mb-3">Sempre que houver dúvida em como o sistema chegou a um desconto de INSS, use a Memória de Cálculo:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                    <li>Expanda um holerite calculado na tela do Motor.</li>
                    <li>Role até o final e clique em <strong>Ver Memória de Cálculo</strong>.</li>
                    <li>O sistema emitirá o rastro logístico linha a linha de cada rubrica: base aplicada, teto esbarrado, fórmula matemática em texto puro e origem. Fim das planilhas escondidas!</li>
                  </ol>
                </section>
              </div>
            </div>
          </div>
        );

      case 'conformidade':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">Sistema e Conformidade</h2>
              <p className="text-slate-600">Gestão global do SaaS, configuração legal governamental e auditoria de ações.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-primary-500" />
                  Auditoria Interna (LogViewer)
                </h3>
                <p className="text-sm text-slate-600">Registra de modo imutável todos os deletes, edições sensíveis e reaberturas de folha. Acesse no menu "Auditoria".</p>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Calculator size={20} className="text-primary-500" />
                  Parâmetros Legais (Tabelas)
                </h3>
                <p className="text-sm text-slate-600">Acesse <strong>Configurações {'>'} Parâmetros Legais</strong> para atualizar as faixas de IRRF (tabela progressiva), alíquotas do INSS e salário mínimo sempre que a lei mudar, sem esperar por atualizações de software.</p>
              </section>
              
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Activity size={20} className="text-primary-500" />
                  Transmissão eSocial e SST
                </h3>
                <p className="text-sm text-slate-600">A interface de mensageria aguarda o XML gerado pelo backend. As admissões (S-2200), folhas fechadas (S-1200) e desligamentos (S-2299) serão enfileirados nos Dashboards correspondentes e exibirão os Recibos de Entrega assim que validados pelo Governo.</p>
              </section>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 shrink-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
          <BookOpen size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">Portal de Conhecimento</h1>
          <p className="text-slate-500 text-sm mt-1">Navegue pelas categorias para entender a arquitetura e fluxos operacionais.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0 pb-4">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                  isActive 
                  ? 'bg-white border-primary-200 shadow-md border shadow-primary-500/5 ring-1 ring-primary-500/20' 
                  : 'bg-transparent border-transparent hover:bg-white/60 border hover:border-slate-200'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                  <cat.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-bold text-sm ${isActive ? 'text-primary-700' : 'text-slate-700'}`}>
                    {cat.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
                {isActive && (
                  <div className="shrink-0 self-center">
                    <ChevronRight size={16} className="text-primary-500" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white/50 backdrop-blur-sm rounded-2xl border border-white p-6 shadow-sm overflow-y-auto">
          {renderContent()}
        </div>

      </div>
    </div>
  );
}
