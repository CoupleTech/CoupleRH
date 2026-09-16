# Guia de Migração Visual — coupleRH Design System "Control Room"

> **Objetivo**: Migrar TODAS as páginas do estilo antigo (`precision-panel`, `zinc-`, `rounded-sm`, inline badges) para o novo Design System definido em `src/index.css`.
> 
> **Este guia é auto-contido.** Um agente deve conseguir executar a migração completa lendo apenas este documento.

---

## 1. CONTEXTO

O projeto coupleRH usa:
- **Stack**: React + Vite + TypeScript + TailwindCSS v4
- **CSS Global**: `src/index.css` — contém o Design System completo com classes utilitárias reutilizáveis
- **Layout**: `src/layouts/DashboardLayout.tsx` — sidebar + topbar (JÁ MIGRADO)
- **Login**: `src/pages/Login.tsx` (JÁ MIGRADO)
- **Dashboard**: `src/pages/Dashboard.tsx` (JÁ MIGRADO)
- **Companies/List.tsx**: (JÁ MIGRADO)
- **Employees.tsx**: (JÁ MIGRADO)
- **Movements.tsx**: (JÁ MIGRADO)
- **Offboarding/List.tsx**: (JÁ MIGRADO)

### Páginas que AINDA PRECISAM ser migradas:
```
src/pages/Companies/Form.tsx
src/pages/Organization/Positions/List.tsx
src/pages/EmployeeForm.tsx
src/pages/EmployeeDetails.tsx
src/pages/EmployeeBenefitsTab.tsx
src/pages/Vacations/List.tsx
src/pages/Vacations/Wizard.tsx
src/pages/Leaves/List.tsx
src/pages/Leaves/Wizard.tsx
src/pages/Benefits/List.tsx
src/pages/Benefits/Catalog.tsx
src/pages/Benefits/Form.tsx
src/pages/Offboarding/Wizard.tsx
src/pages/TimeTracking/Timesheet.tsx
src/pages/Payroll/Calculations.tsx
src/pages/Payroll/Payslips.tsx
src/pages/Payroll/Rubrics.tsx
src/pages/eSocial/Dashboard.tsx
src/pages/SST/Dashboard.tsx
src/pages/Documents/Templates.tsx
src/pages/Documents/SignaturesVault.tsx
src/pages/Audit/LogViewer.tsx
src/pages/Settings/Dashboard.tsx
src/pages/Portals/ (qualquer arquivo dentro)
```

---

## 2. TABELA DE SUBSTITUIÇÃO GLOBAL (FIND → REPLACE)

Aplique estas substituições em TODOS os arquivos `.tsx` dentro de `src/pages/`:

### 2.1 Classes CSS — Painéis e Containers
| ANTIGO | NOVO |
|--------|------|
| `precision-panel` | `panel` (com borda) ou `panel-flush` (sem overflow, para tabelas) |
| `precision-panel p-4 border-b-0 rounded-b-none` | Remover completamente. Usar toolbar dentro do `panel-flush` |
| `precision-panel rounded-t-none overflow-x-auto shadow-sm` | Remover completamente. Já faz parte do `panel-flush` |
| `bg-white p-8 rounded-2xl border border-slate-200 shadow-sm` | `panel p-0` e colocar conteúdo em `<div className="p-6 lg:p-8">` |

### 2.2 Cores — zinc → slate
| ANTIGO | NOVO |
|--------|------|
| `zinc-50` | `slate-50` |
| `zinc-100` | `slate-100` |
| `zinc-200` | `slate-200` |
| `zinc-300` | `slate-300` |
| `zinc-400` | `slate-400` |
| `zinc-500` | `slate-500` |
| `zinc-600` | `slate-600` |
| `zinc-700` | `slate-700` |
| `zinc-800` | `slate-800` |
| `zinc-900` | `slate-900` |

> ⚠️ Fazer find/replace de `zinc-` → `slate-` em todo o arquivo. Simples e direto.

### 2.3 Border Radius
| ANTIGO | NOVO |
|--------|------|
| `rounded-sm` | `rounded-lg` |

### 2.4 Animações
| ANTIGO | NOVO |
|--------|------|
| `animate-in fade-in slide-in-from-bottom-4 duration-500` | `animate-fade-up` |
| `animate-in fade-in slide-in-from-bottom-8 duration-700` | `animate-fade-up` |

### 2.5 Títulos de Página (H1)
| ANTIGO | NOVO |
|--------|------|
| `text-2xl font-bold text-zinc-900 font-display` | `text-2xl font-extrabold text-slate-900 font-display` |
| `text-2xl font-bold text-slate-800` | `text-2xl font-extrabold text-slate-900 font-display` |

### 2.6 Botões — usar classes do Design System
| ANTIGO | NOVO |
|--------|------|
| `flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-sm font-bold shadow-sm hover:bg-primary-700 transition-colors` | `btn-primary` |
| `flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2.5 rounded-sm font-bold shadow-sm hover:bg-zinc-50 transition-colors` | `btn-secondary` |
| `flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-sm font-bold shadow-sm hover:bg-rose-700 transition-colors` | `btn-danger` |
| `flex items-center gap-2 bg-emerald-600 text-white ...` | `btn-primary` (ou manter se for semântico verde) |
| Qualquer botão cinza/ghost inline | `btn-ghost` |
| `px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm` | `btn-primary` |

> ⚠️ Ao usar `btn-primary`, os ícones dentro devem ter `size={16}` e o texto fica dentro de `<span>`.

### 2.7 Inputs — usar classes do Design System
| ANTIGO | NOVO |
|--------|------|
| `block w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-sm bg-zinc-50 focus:bg-white text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-all` | `input pl-10` |
| `w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none` | `input` |
| `w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none` | `input` |
| Qualquer `<select>` com estilos inline de borda/bg | `input` (funciona para selects também) |
| Qualquer `<textarea>` com estilos inline | `input min-h-[100px] resize-y` |

### 2.8 Labels de formulário
| ANTIGO | NOVO |
|--------|------|
| `block text-sm font-semibold text-slate-700 mb-1` | `input-label` |
| `block text-sm font-semibold text-zinc-700 mb-1` | `input-label` |
| `text-xs font-bold text-zinc-600 mb-1` | `input-label` |

### 2.9 Badges de Status
Substituir TODOS os badges inline por classes do Design System.

**ANTES** (qualquer variação de):
```tsx
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-800">Ativo</span>
```

**DEPOIS** (usar a classe correspondente):
```tsx
<span className="badge-success">Ativo</span>     // Verde — ativo, aprovado, concluído
<span className="badge-warning">Pendente</span>   // Amarelo — em andamento, atenção
<span className="badge-danger">Erro</span>        // Vermelho — rejeitado, vencido, erro
<span className="badge-info">Info</span>          // Azul — solicitado, em progresso
<span className="badge-neutral">Padrão</span>     // Cinza — neutro, desconhecido
```

> ⚠️ Cada badge antigo usa estilos inline diferentes. Mapear pela SEMÂNTICA da cor:
> - `bg-emerald-*` / `bg-green-*` → `badge-success`
> - `bg-amber-*` / `bg-yellow-*` → `badge-warning`
> - `bg-red-*` / `bg-rose-*` → `badge-danger`
> - `bg-blue-*` / `bg-sky-*` → `badge-info`
> - `bg-zinc-*` / `bg-slate-*` / `bg-gray-*` / `bg-purple-*` → `badge-neutral`

---

## 3. PADRÃO ESTRUTURAL POR TIPO DE PÁGINA

### 3.1 Páginas de LISTA (tabelas)

**Estrutura correta:**
```tsx
<div className="animate-fade-up">
  {/* Header da página */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 font-display">Título</h1>
      <p className="text-sm text-slate-500 mt-1">Descrição</p>
    </div>
    <button className="btn-primary">
      <Plus size={16} />
      <span>Ação</span>
    </button>
  </div>

  {/* Painel com tabela */}
  <div className="panel-flush">
    {/* Toolbar de busca */}
    <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="relative w-full sm:w-96">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar..."
          className="input pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>

    {/* Tabela */}
    <div className="overflow-x-auto min-h-[300px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="table-header px-6 py-3.5">Coluna</th>
          </tr>
        </thead>
        <tbody>
          {/* Loading state */}
          <tr>
            <td colSpan={N} className="px-6 py-16 text-center">
              <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary-500 mb-3" />
              <p className="text-sm text-slate-400 font-medium">Carregando...</p>
            </td>
          </tr>
          
          {/* Empty state */}
          <tr>
            <td colSpan={N} className="px-6 py-16 text-center">
              <IconRelevante size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Nenhum item encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Texto auxiliar</p>
            </td>
          </tr>
          
          {/* Data rows */}
          <tr className="table-row group cursor-pointer">
            <td className="table-cell">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">Nome</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Detalhe</p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

### 3.2 Páginas de FORMULÁRIO

**Estrutura correta:**
```tsx
<div className="animate-fade-up max-w-4xl mx-auto">
  {/* Header com botão voltar */}
  <div className="flex items-center gap-4 mb-8">
    <button onClick={() => navigate(-1)} className="btn-ghost p-2">
      <ArrowLeft size={20} />
    </button>
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 font-display">Título</h1>
      <p className="text-sm text-slate-500 mt-1">Descrição</p>
    </div>
  </div>

  {/* Formulário */}
  <div className="panel p-0">
    <div className="p-6 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="input-label">Label</label>
          <input className="input" />
        </div>
        <div>
          <label className="input-label">Label</label>
          <select className="input">...</select>
        </div>
        <div className="sm:col-span-2">
          <label className="input-label">Label</label>
          <textarea className="input min-h-[100px] resize-y" />
        </div>
      </div>
      
      {/* Footer de ações */}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
        <button className="btn-primary">
          <Save size={16} />
          <span>Salvar</span>
        </button>
      </div>
    </div>
  </div>
</div>
```

### 3.3 Páginas de WIZARD (multi-step)

**Estrutura correta para steps:**
```tsx
<div className="animate-fade-up max-w-4xl mx-auto">
  {/* Header */}
  <div className="flex items-center gap-4 mb-8">...</div>

  {/* Step indicator */}
  <div className="flex items-center gap-2 mb-6">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
          i === currentStep 
            ? 'bg-primary-500 text-white shadow-sm' 
            : i < currentStep 
              ? 'bg-primary-50 text-primary-600' 
              : 'bg-slate-100 text-slate-400'
        }`}>
          {i + 1}
        </div>
        <span className={`text-sm font-medium hidden sm:inline ${
          i === currentStep ? 'text-slate-900' : 'text-slate-400'
        }`}>{step.label}</span>
        {i < steps.length - 1 && <div className="w-8 h-px bg-slate-200" />}
      </div>
    ))}
  </div>

  {/* Conteúdo do step */}
  <div className="panel p-0">
    <div className="p-6 lg:p-8">
      {/* ... campos do step ... */}
    </div>
    
    {/* Footer de navegação */}
    <div className="px-6 lg:px-8 py-4 border-t border-slate-100 flex justify-between">
      <button className="btn-ghost" onClick={prevStep}>Voltar</button>
      <button className="btn-primary" onClick={nextStep}>
        Próximo <ChevronRight size={16} />
      </button>
    </div>
  </div>
</div>
```

### 3.4 Páginas de DETALHE (ex: EmployeeDetails)

**Estrutura correta:**
```tsx
<div className="animate-fade-up">
  {/* Header com ações */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
    <div className="flex items-center gap-4">
      <button onClick={() => navigate(-1)} className="btn-ghost p-2">
        <ArrowLeft size={20} />
      </button>
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 font-display">Nome do Item</h1>
        <p className="text-sm text-slate-500 mt-1">Detalhes do registro</p>
      </div>
    </div>
    <div className="flex gap-2">
      <button className="btn-secondary">Editar</button>
      <button className="btn-danger">Excluir</button>
    </div>
  </div>

  {/* Cards de informação */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="panel p-5">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Label</p>
      <p className="text-lg font-bold text-slate-900 font-display">Valor</p>
    </div>
  </div>
  
  {/* Tabs de seções */}
  <div className="mt-8">
    <div className="flex gap-1 border-b border-slate-200 mb-0">
      <button className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
        activeTab === 'tab1' 
          ? 'bg-white text-primary-600 border-t-2 border-primary-500 border-x border-slate-200 -mb-px' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}>Tab 1</button>
    </div>
    <div className="panel-flush rounded-t-none border-t-0">
      {/* Conteúdo da tab */}
    </div>
  </div>
</div>
```

### 3.5 Páginas de DASHBOARD (ex: SST, eSocial, Settings)

**Estrutura correta:**
```tsx
<div className="animate-fade-up">
  <div className="mb-8">
    <h1 className="text-2xl font-extrabold text-slate-900 font-display">Título</h1>
    <p className="text-sm text-slate-500 mt-1">Descrição</p>
  </div>

  {/* KPI Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <div className="kpi-card group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary-50 text-primary-500">
          <Icon size={18} />
        </div>
        <span className="badge-info">Label</span>
      </div>
      <p className="kpi-value">123</p>
      <p className="kpi-label mt-1">Descrição</p>
    </div>
  </div>

  {/* Content panels */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="panel-flush">
      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-900 font-display text-sm">Seção</h3>
          <p className="text-xs text-slate-400 mt-0.5">Subtítulo</p>
        </div>
      </div>
      <div className="p-5">
        {/* conteúdo */}
      </div>
    </div>
  </div>
</div>
```

---

## 4. ALERTAS E FEEDBACK (inline)

### Alertas dentro de formulários
```tsx
{/* Sucesso */}
<div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium animate-fade-up">
  Mensagem de sucesso
</div>

{/* Erro */}
<div className="p-3.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium animate-fade-up">
  Mensagem de erro
</div>

{/* Warning */}
<div className="p-3.5 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700 font-medium animate-fade-up">
  Mensagem de atenção
</div>

{/* Info */}
<div className="p-3.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium animate-fade-up">
  Mensagem informativa
</div>
```

### Destaque de valores (dentro de forms/detalhes)
```tsx
<div className="p-5 bg-primary-50/50 border border-primary-100 rounded-lg">
  <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wider mb-1.5">Label</p>
  <p className="font-bold text-slate-900 font-display text-lg">Valor</p>
</div>
```

---

## 5. COMPONENTES COMUNS

### Avatar / Initial circle
```tsx
{/* Com gradiente (para pessoas) */}
<div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
  {name.charAt(0)}
</div>

{/* Com ícone (para entidades) */}
<div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 shrink-0">
  <Building2 size={18} />
</div>

{/* Neutro (para inativos) */}
<div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
  {name.charAt(0)}
</div>
```

### Tabs (dentro de páginas)
```tsx
<div className="flex gap-1 border-b border-slate-200">
  {tabs.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
        activeTab === tab.id
          ? 'bg-white text-primary-600 border-t-2 border-primary-500 border-x border-slate-200 -mb-px'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      <tab.icon size={16} />
      {tab.label}
    </button>
  ))}
</div>
```

### Empty state genérico
```tsx
<div className="py-16 text-center">
  <IconRelevante size={32} className="text-slate-200 mx-auto mb-3" />
  <p className="text-sm text-slate-500 font-medium">Nenhum registro encontrado</p>
  <p className="text-xs text-slate-400 mt-1">Texto auxiliar explicativo</p>
</div>
```

### Loading state genérico
```tsx
<div className="flex justify-center items-center h-40">
  <div className="flex flex-col items-center gap-3">
    <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
    <p className="text-sm text-slate-400 font-medium">Carregando dados...</p>
  </div>
</div>
```

---

## 6. REGRAS DE TIPOGRAFIA

| Contexto | Classes |
|----------|---------|
| Título de página (h1) | `text-2xl font-extrabold text-slate-900 font-display` |
| Subtítulo de página | `text-sm text-slate-500 mt-1` |
| Título de seção/card | `font-bold text-slate-900 font-display text-sm` |
| Subtítulo de seção | `text-xs text-slate-400 mt-0.5` |
| Texto de corpo | `text-sm text-slate-700` |
| Texto secundário | `text-sm text-slate-500` |
| Texto auxiliar | `text-xs text-slate-400` |
| Monospaced (CNPJ, código) | `font-mono text-sm text-slate-600 tabular-nums` |
| KPI valor | `kpi-value` (classe do DS) |
| KPI label | `kpi-label` (classe do DS) |

---

## 7. REGRAS DE COR E SEMÂNTICA

| Significado | Cores Background/Text |
|-------------|----------------------|
| Sucesso / Ativo / Aprovado | `emerald-50` bg, `emerald-700` text |
| Atenção / Pendente | `amber-50` bg, `amber-700` text |
| Erro / Rejeitado / Vencido | `red-50` bg, `red-700` text |
| Info / Em andamento | `blue-50` bg, `blue-700` text |
| Neutro / Default | `slate-100` bg, `slate-600` text |
| Primary accent | `primary-50` bg, `primary-500` text |

---

## 8. CHECKLIST DE VALIDAÇÃO POR ARQUIVO

Para CADA arquivo migrado, verificar:

- [ ] Nenhuma referência a `zinc-` (tudo deve ser `slate-`)
- [ ] Nenhuma referência a `precision-panel` (usar `panel` ou `panel-flush`)
- [ ] Nenhum `rounded-sm` (usar `rounded-lg`)
- [ ] Nenhum `animate-in fade-in slide-in-from-bottom` (usar `animate-fade-up`)
- [ ] Todos os botões de ação principal usam `btn-primary`
- [ ] Todos os botões secundários usam `btn-secondary`
- [ ] Todos os inputs usam a classe `input`
- [ ] Todos os labels de formulário usam `input-label`
- [ ] Todos os badges usam `badge-success/warning/danger/info/neutral`
- [ ] Tabelas usam `table-header`, `table-row`, `table-cell`
- [ ] H1 usa `font-extrabold` (não `font-bold`)
- [ ] Tamanho dos ícones dentro de botões: `size={16}`
- [ ] Ícones de tabela/listas: `size={18}`

---

## 9. CLASSES DISPONÍVEIS NO DESIGN SYSTEM (src/index.css)

```
PAINÉIS:        panel, panel-flush, panel-dark
DIVIDERS:       divider, divider-strong
SIDEBAR:        sidebar-section-label, sidebar-item, sidebar-item-active
BADGES:         badge, badge-success, badge-warning, badge-danger, badge-info, badge-neutral
BUTTONS:        btn, btn-primary, btn-secondary, btn-danger, btn-ghost
INPUTS:         input, input-label
KPI:            kpi-card, kpi-value, kpi-label, kpi-icon
TABLES:         table-header, table-row, table-cell
ANIMATIONS:     animate-fade-up, animate-fade-in, animate-pulse-ring
STAGGER:        stagger-1, stagger-2, stagger-3, stagger-4
```

---

## 10. OBSERVAÇÕES IMPORTANTES

1. **NÃO alterar lógica de negócio** — apenas classes CSS e estrutura JSX visual
2. **NÃO remover imports ou funções** — manter toda a lógica intacta
3. **NÃO alterar chamadas ao Supabase** — são intocáveis
4. **Manter responsividade** — usar `sm:`, `lg:` breakpoints onde já existem
5. **Tailwind v4** — não usar `@apply` com classes customizadas dentro de `@apply` (ex: `@apply badge bg-*` vai falhar). As classes customizadas já estão corretamente definidas no `index.css`
6. **Ícones** — o projeto usa `lucide-react`. Manter os mesmos ícones, só ajustar tamanhos
7. **Fontes** — `font-display` = Plus Jakarta Sans (headings), `font-sans` = Inter (body), `font-mono` = JetBrains Mono (dados)

---

## 11. EXEMPLO COMPLETO DE MIGRAÇÃO (ANTES → DEPOIS)

### ANTES:
```tsx
<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
  <div className="flex justify-between mb-8">
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 font-display">Título</h1>
      <p className="text-sm text-zinc-500">Sub</p>
    </div>
    <button className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-sm font-bold shadow-sm hover:bg-primary-700 transition-colors">
      <Plus size={18} /> Nova coisa
    </button>
  </div>

  <div className="precision-panel p-4 border-b-0 rounded-b-none">
    <input className="block w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-sm bg-zinc-50 ..." />
  </div>
  <div className="precision-panel rounded-t-none overflow-x-auto shadow-sm">
    <table>
      <thead>
        <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <th className="px-6 py-4">Col</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        <tr className="hover:bg-zinc-50 transition-colors">
          <td className="px-6 py-4 font-bold text-zinc-800">Dado</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### DEPOIS:
```tsx
<div className="animate-fade-up">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 font-display">Título</h1>
      <p className="text-sm text-slate-500 mt-1">Sub</p>
    </div>
    <button className="btn-primary">
      <Plus size={16} />
      <span>Nova coisa</span>
    </button>
  </div>

  <div className="panel-flush">
    <div className="px-5 py-4 border-b border-slate-100">
      <div className="relative w-full sm:w-96">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input className="input pl-10" placeholder="Buscar..." />
      </div>
    </div>
    <div className="overflow-x-auto min-h-[300px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="table-header px-6 py-3.5">Col</th>
          </tr>
        </thead>
        <tbody>
          <tr className="table-row group cursor-pointer">
            <td className="table-cell">
              <span className="font-bold text-slate-800 group-hover:text-primary-600 transition-colors">Dado</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

---

> **FIM DO GUIA** — Seguindo este documento, qualquer agente consegue migrar todas as páginas restantes de forma consistente e previsível.
