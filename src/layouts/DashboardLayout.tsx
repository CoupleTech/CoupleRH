import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, Users, Settings, LogOut, LayoutDashboard,
  CalendarDays, FileText, ShieldCheck, UserMinus, Stethoscope,
  Briefcase, Clock, Calculator, Activity, ShieldAlert, TrendingUp,
  ChevronDown, ChevronUp, ChevronRight, Menu, X, Bell, Check, GitBranch, Landmark, MapPin, Watch, HelpCircle
} from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Painel Geral' },
      { to: '/empresas', icon: Building2, label: 'Empresas' },
    ]
  },
  {
    label: 'Organização',
    items: [
      { to: '/departamentos', icon: Building2, label: 'Departamentos' },
      { to: '/setores', icon: GitBranch, label: 'Setores' },
      { to: '/centros-de-custo', icon: Landmark, label: 'Centros de Custo' },
      { to: '/lotacoes', icon: MapPin, label: 'Lotações / Locais' },
      { to: '/cargos', icon: Briefcase, label: 'Cargos e CBO' },
      { to: '/tipos-de-contrato', icon: FileText, label: 'Tipos de Contrato' },
      { to: '/funcionarios', icon: Users, label: 'Colaboradores' },
      { to: '/funcionarios/movimentacoes', icon: TrendingUp, label: 'Movimentações' },
      { to: '/desligamentos', icon: UserMinus, label: 'Desligamentos' },
    ]
  },
  {
    label: 'Ponto e Escalas',
    items: [
      { to: '/jornadas', icon: Clock, label: 'Jornadas de Trabalho' },
      { to: '/feriados', icon: CalendarDays, label: 'Feriados' },
    ]
  },
  {
    label: 'Gestão e Rotinas',
    items: [
      { to: '/ferias', icon: CalendarDays, label: 'Férias' },
      { to: '/afastamentos', icon: Stethoscope, label: 'Afastamentos' },
      { to: '/beneficios', icon: Briefcase, label: 'Benefícios' },
    ]
  },
  {
    label: 'Ponto e Folha',
    items: [
      { to: '/ponto/espelho', icon: Clock, label: 'Espelho de Ponto' },
      { to: '/folha/processamento', icon: Calculator, label: 'Motor de Cálculo' },
      { to: '/folha/lancamentos', icon: Activity, label: 'Lançamentos Variáveis' },
      { to: '/folha/holerites', icon: FileText, label: 'Holerites' },
      { to: '/folha/rubricas', icon: Settings, label: 'Rubricas e Regras' },
    ]
  },
  {
    label: 'Conformidade',
    items: [
      { to: '/esocial', icon: Activity, label: 'eSocial' },
      { to: '/sst', icon: ShieldAlert, label: 'SST' },
    ]
  },
  {
    label: 'Documentos',
    items: [
      { to: '/documentos/templates', icon: FileText, label: 'Modelos' },
      { to: '/documentos/cofre', icon: ShieldCheck, label: 'Cofre Digital' },
    ]
  },
  {
    label: 'Sistema',
    items: [
      { to: '/auditoria', icon: ShieldCheck, label: 'Auditoria' },
      { to: '/configuracoes', icon: Settings, label: 'Configurações Globais' },
      { to: '/configuracoes/tabelas-legais', icon: Calculator, label: 'Parâmetros Legais' },
      { to: '/ajuda', icon: HelpCircle, label: 'Ajuda / Tutorial' },
    ]
  },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('@coupleRH:collapsedSections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Salvar preferências de menu no localStorage
  useEffect(() => {
    localStorage.setItem('@coupleRH:collapsedSections', JSON.stringify(Array.from(collapsedSections)));
  }, [collapsedSections]);

  const isItemActive = (path: string) => {
    if (path === '/funcionarios') {
      return location.pathname === '/funcionarios' || (location.pathname.startsWith('/funcionarios/') && !location.pathname.startsWith('/funcionarios/movimentacoes'));
    }
    if (path === '/configuracoes') {
      return location.pathname === '/configuracoes';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const allCollapsed = collapsedSections.size === NAV_SECTIONS.length;

  const toggleAllSections = () => {
    if (allCollapsed) {
      setCollapsedSections(new Set());
    } else {
      setCollapsedSections(new Set(NAV_SECTIONS.map(s => s.label)));
    }
  };

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || 'U';
  const userName = user?.email?.split('@')[0] || 'Usuário';

  const renderSidebarContent = () => (
    <>
      {/* Logo e Controles */}
      <div className="px-5 pt-6 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <span className="text-white font-extrabold text-sm font-display">cR</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight font-display leading-none">
              couple<span className="text-primary-400">RH</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">Departamento Pessoal</p>
          </div>
        </div>
        
        <button 
          onClick={toggleAllSections}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold cursor-pointer group"
        >
          {allCollapsed ? (
            <>
              <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
              Abrir Menus
            </>
          ) : (
            <>
              <ChevronUp size={14} className="group-hover:-translate-y-0.5 transition-transform" />
              Recolher Menus
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-1">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsedSections.has(section.label);
          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-5 py-2 mt-3 mb-0.5 group cursor-pointer"
              >
                <span className="sidebar-section-label !px-0">{section.label}</span>
                <ChevronDown 
                  size={12} 
                  className={`text-slate-600 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} 
                />
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={() =>
                        `relative ${isItemActive(item.to) ? 'sidebar-item-active' : 'sidebar-item'}`
                      }
                    >
                      <item.icon size={16} strokeWidth={isItemActive(item.to) ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/50">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04] mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate capitalize">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-left text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/[0.06] text-sm font-medium cursor-pointer"
        >
          <LogOut size={16} />
          <span>Encerrar sessão</span>
        </button>
      </div>
    </>
  );

  // Helper to check if a nav item is active (for icon weight)
  function isActive(path: string): boolean {
    return window.location.pathname === path;
  }

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Desktop Sidebar */}
      <aside className="w-[260px] bg-[#0c1222] text-slate-300 hidden lg:flex flex-col fixed inset-y-0 left-0 z-30">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0c1222] text-slate-300 flex flex-col animate-fade-in">
            <div className="absolute right-3 top-3">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-[260px] flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          {/* Mobile menu button */}
          <button 
            onClick={() => setMobileOpen(true)} 
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
          >
            <Menu size={20} />
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden font-bold text-slate-900 font-display text-base">
            couple<span className="text-primary-500">RH</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2 relative">
            
            {/* Company Selector */}
            <div className="relative">
              <button 
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors mr-2 cursor-pointer"
              >
                <Building2 size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">
                  {selectedCompany?.trade_name || selectedCompany?.corporate_name || "Selecione a Empresa"}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {companyDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Alternar Empresa
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {companies.map(company => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setCompanyDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between group cursor-pointer"
                      >
                        <div className="truncate pr-4">
                          <p className="text-sm font-medium text-slate-700 group-hover:text-primary-600 transition-colors truncate">
                            {company.trade_name || company.corporate_name}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {company.cnpj}
                          </p>
                        </div>
                        {selectedCompanyId === company.id && (
                          <Check size={16} className="text-primary-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {companies.length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        Nenhuma empresa cadastrada.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Overlay for dropdown */}
            {companyDropdownOpen && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setCompanyDropdownOpen(false)} 
              />
            )}

            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors relative cursor-pointer relative z-50">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
            </button>
            <div className="hidden sm:flex items-center gap-3 pl-3 ml-1 border-l border-slate-200 relative z-50">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800 capitalize">{userName}</p>
                <p className="text-[11px] text-slate-400">{user?.email}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-8 max-w-[1800px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
