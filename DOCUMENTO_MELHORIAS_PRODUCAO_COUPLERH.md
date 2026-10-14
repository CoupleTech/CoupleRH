# CoupleRH: Documento de Melhorias e Correções para Produção

| Item | Valor |
|---|---|
| Versão / data | 1.0 · 09/10/2026 |
| Escopo | Motor de folha, catálogo de rubricas, segurança, **ponto eletrônico (novo)**, **assinatura digital (novo)**, qualidade e governança |
| Stack | React 19 + Vite (Vercel) · Supabase (Postgres, Auth, Storage, Edge Functions Deno) |
| Base da análise | Repositório `CoupleTech/CoupleRH` (código do `payroll-engine`, telas, migrations, testes) e consultas ao banco enviadas pelo usuário |
| Como usar | Este documento descreve **o quê e como**. O arquivo `fase.md` define **a ordem, o status e os critérios de aceite**. O agente executa o `fase.md` e consulta este documento pelos códigos (T1, PT-03, AS-05...). |

> **Avisos importantes**
> 1. Valores legais de 2026 (faixas de INSS/IRRF, redutor, R$ 607,20, teto) e as referências legais citadas vêm de conhecimento do autor e de simulação; **devem ser confirmados por contador/consultor trabalhista nas fontes oficiais antes da produção**.
> 2. Não houve acesso ao banco de produção nem a dados reais; os achados vêm do código, das migrations e das consultas enviadas.
> 3. Nenhuma correção deste documento foi executada ou testada no sistema.

---

## 1. Sumário executivo

O CoupleRH tem boa base (multiempresa, motor com memória de cálculo, tabelas legais versionadas, férias, rescisão, portal do colaborador, auditoria parcial). Para entrar em produção como sistema de folha e ponto, há **bloqueadores**:

| # | Bloqueador | Impacto |
|---|---|---|
| B1 | IRRF calculado sobre base já sem INSS, e simplificada sobreposta a ele | IRRF retido a menos acima de ~R$ 5.000 |
| B2 | Catálogo de rubricas: só 4 de ~40 têm incidências | Adicionais, comissões, férias, 13º e DSR ficam fora de INSS/IRRF/FGTS |
| B3 | Função `payroll-engine` sem autenticação (usa `service_role`) | Qualquer chamada pode recalcular qualquer período de qualquer empresa |
| B4 | Erro de cálculo vira holerite zerado marcado como `CALCULATED` | Folha silenciosamente errada |
| B5 | **eSocial simulado** (recibos aleatórios) | Risco legal se interpretado como transmissão real |
| B6 | **Sem marcação de ponto real** (hoje só fechamento manual de espelho) | Não atende a pergunta da advogada; exposição trabalhista (horas extras, banco de horas) |
| B7 | **Assinatura de documentos fraca** (RPC só troca status; sem evidência, sem rubrica, PDF gerado no cliente) | Prova frágil de recebimento de holerite, férias e espelho |

**Recomendação de go-live em duas ondas**

- **Onda 1 (folha):** Fases P0 a P4 e P7 do `fase.md`, com **folha paralela de 2 a 3 competências** validada por contador.
- **Onda 2 (ponto + assinatura):** Fases P5 e P6 (ponto/AFD/celular/banco de horas e assinatura), podendo evoluir em paralelo e entrar antes da folha se o jurídico priorizar.
- **eSocial real (P10):** projeto separado, após estabilização.

Responder às perguntas da advogada: **sim, é possível** implementar tudo o que foi pedido (ponto por relógio Control iD, importação, ponto por celular, banco de horas visível ao colaborador, assinatura na tela com rubrica em PDF). Detalhes e ressalvas nas seções 7 e 8.

---

## 2. Arquitetura atual (resumo)

- **Frontend (Vercel):** `src/pages/*` (Payroll, Employees, Vacations, TimeTracking, Documents, Portals, eSocial, SST, Settings).
- **Backend (Supabase):** 64 migrations; Edge Functions `payroll-engine`, `termination-engine`, `invite-user`.
- **Motor:** `payroll-engine/index.ts` (monta contexto por contrato) → `PayrollContext` → `PayrollEngine` (DAG de rubricas, bases, INSS/IRRF/FGTS) → grava `payslips`, `payslip_items`, `payroll_memory_calc`, `payroll_company_taxes`.
- **Tabelas de ponto já existentes:** `work_schedules`, `time_entries` (com `device_info`), `time_entry_adjustments`, `time_bank_accounts`, `time_bank_transactions`, `timesheets`.
- **Assinatura já existente:** `document_templates`, `employee_documents` (com `document_hash`), `signatures_log`, RPCs `get_worker_signatures` e `sign_worker_document`.
- **Auditoria:** schema `audit.logs` com gatilhos em ~20 tabelas.
- **Testes:** Vitest, 26 de 27 passando (falha `Termination.test.ts`).

---

## 3. Mapa de achados

Gravidade: 🔴 bloqueia produção · 🟠 corrigir antes da onda correspondente · 🟡 melhoria.

| ID | Gravidade | Onde | Resumo |
|---|---|---|---|
| T1 | 🔴 | `PayrollEngine`, `IRRFCalculator` | IRRF sobre base líquida de INSS; simplificada e redutor errados |
| T2 | 🔴 | `index.ts` | Rubricas compartilhadas e mutadas entre colaboradores |
| T3 | 🔴 | `index.ts`, `PayrollContext`, calculadoras | `salario_minimo` não enviado; valores 2026 chumbados e fallbacks silenciosos |
| T4 | 🔴 | `index.ts` | DSR distorcido pela normalização para 30 dias |
| T5 | 🔴 | `index.ts`, `PayrollEngine` | Erro de cálculo gravado como holerite calculado |
| T6 | 🔴 | `index.ts` | INSS/IRRF/FGTS podem não entrar nos itens do holerite |
| T8 | 🔴 | `index.ts` | Função sem autenticação; CORS `*`; `debug` na resposta |
| T26 | 🔴 | `eSocial/Dashboard.tsx` | Transmissão simulada com recibo aleatório |
| T27 | 🔴 | RPC `sign_worker_document` | `SECURITY DEFINER` que só marca `SIGNED`, sem verificar quem chama, sem hash/IP/log |
| T30 | 🔴 | `payroll_rubrics` (dados) | Catálogo sem incidências/forma de cálculo; DSR provavelmente em duplicidade |
| T7 | 🟠 | `index.ts` | Falhas silenciosas de tabela legal (fallback para tabela 2026 embutida) |
| T9 | 🟠 | `index.ts` | Recálculo não atômico |
| T10 | 🟠 | `index.ts` | Impostos patronais errados no recálculo por contrato |
| T11 | 🟠 | `index.ts` | Admissão em mês futuro entra na folha |
| T12 | 🟠 | `index.ts` | Rubricas 250/850 criadas com colunas possivelmente inexistentes |
| T13 | 🟠 | `index.ts` | `OR` em cascata impede desligar a base de incidência |
| T14 | 🟠 | `index.ts`, motor | Valor manual de evento fixo sobrepõe regra (insalubridade etc.) |
| T15 | 🟠 | `index.ts` | Férias que atravessam o mês não reduzem dias trabalhados |
| T16 | 🟠 | motor | INSS por competência não consolidado entre folhas (férias + mensal) |
| T17 | 🟠 | `index.ts` | Descontos fixos entram em férias/13º/complementar |
| T18 | 🟠 | motor | Hora extra sem adicionais na base; DSR sem noturno; noturno incompleto |
| T19 | 🟠 | vários | Dependentes (idade), 13º, FGTS aprendiz, patronais por regime, versões gravadas |
| T20 | 🟠 | testes | `Termination.test.ts` falhando |
| T29 | 🟠 | banco | Auditoria sem gatilhos em `payslips`, `payslip_items`, `payroll_periods`, `employee_deductions`, `employee_fixed_events`, tabelas legais |
| T21 | 🟡 | motor | Dinheiro em `float` |
| T22 | 🟡 | motor/UI | Regras por nome/código → campo `kind` explícito |
| T23 | 🟡 | `DAGResolver` | Dependências só por `calculation_base` |
| T24 | 🟡 | `RubricFormulaParser` | Tokenizer descarta caracteres, sem comparadores, `0,5` quebra, variável desconhecida = 0 |
| T25 | 🟡 | vários | `getVariable` mudo, `calculation_order || 100`, eventos negativos, performance, versões de libs |

---

## 4. Correções do motor e do backend

### Regras de execução (valem para todas)
1. Um item = um commit com teste. Rodar `npx vitest run` antes e depois.
2. Escrever o teste do critério de aceite **antes** da correção.
3. Valores legais só vêm de `legal_versions`, `inss_parameters`, `irrf_parameters`, `general_legal_parameters`. Sem fallback embutido.
4. Nunca calcular regra legal no frontend. Nunca `eval()`. Nunca `float` para dinheiro (alvo em T21).

### T1. IRRF: base bruta, INSS real, simplificada e redutor corretos
**Problema:** o motor faz `base_irrf -= inss` e chama `IRRFCalculator.calculate(base_irrf, 0, ...)`. A simplificada vira `bruto − INSS − 607,20`; o redutor 2026 usa base líquida.
**Correção no motor:**
```ts
const baseIrrfBruta = this.context.base_irrf;                 // guardar ANTES do INSS
inssResult = INSSCalculator.calculate(this.context.base_inss, this.context.inss_parameters);
if (inssResult.value > 0) {
  this.context.total_descontos += inssResult.value;
  // REMOVER: this.context.base_irrf -= inssResult.value;
}
irrfResult = IRRFCalculator.calculate(baseIrrfBruta, inssResult.value, dependentes,
                                      this.context.irrf_parameters, this.context.general_legal_parameters);
// bases.irrf no retorno = irrfResult.legalBase (base de cálculo pós-deduções); manter a bruta na memória
```
**Correção no calculador:** receber `rendimentoTributavel`; `baseLegal = bruto − inss − dependentes×dedução − pensão`; `baseSimpl = bruto − simplified_discount`; usar a **menor**; localizar faixa (última aberta; sem faixa = erro); aplicar redutor com `irrf_exemption_limit`, `irrf_base_reduction`, `irrf_reduction_formula_limit` e novas colunas `irrf_reduction_a` (978,62) e `irrf_reduction_b` (0,133145), **sobre o rendimento bruto**; resultado nunca negativo; ausência de parâmetro = erro.
**Aceite (integração motor + calculador, sem dependentes; confirmar com contador/Receita):**

| Bruto | INSS | IRRF esperado |
|---|---|---|
| 5.000,00 | 501,51 | 0,00 |
| 5.300,00 | 543,51 | 108,84 |
| 6.000,00 | 641,51 | 385,10 |
| 7.000,00 | 781,51 | 754,75 |
| 7.350,00 | 830,51 | 884,13 |
| 12.000,00 | 988,09 | 2.119,55 |

### T2. Isolar rubricas por colaborador
Clonar na entrada do motor (`applicableRubrics = applicableRubrics.map(r => structuredClone(r))`) e eliminar toda escrita em `rubric.*` dentro do `PayrollEngine` (usar variáveis locais). **Aceite:** dois contratos seguidos na mesma lista: o DSR do segundo não herda o percentual do primeiro.

### T3. Parâmetros legais e salário mínimo
- `contextData.salario_minimo = general_legal_parameters.minimum_wage` (erro se ausente).
- Migration: `irrf_reduction_a numeric(12,2)` (978.62), `irrf_reduction_b numeric(12,6)` (0.133145) em `general_legal_parameters`; atualizar `Settings/LegalTables` e a interface `GeneralLegalParameters`.
- Remover fallbacks 2026 de `INSSCalculator`, `IRRFCalculator` e `PayrollContext`. `HORAS_TRABALHADAS` deve usar `divisor`; `DIAS_UTEIS`/`DIAS_INUTEIS` usar os mesmos valores dos campos.
- **Verificado no banco:** tabelas INSS (4 faixas, teto 8.475,55), IRRF (5 faixas, última aberta) e parâmetros gerais estão cadastrados com os nomes de coluna que o código lê. Existe uma única versão legal (2026-01-01, sem fim): competências anteriores devem falhar com erro claro, não usar tabela embutida.

### T4. DSR com dias reais
Apagar o bloco "Normaliza para 30 dias". Salário continua proporcional em base 30; o DSR usa dias reais. **Aceite:** fev/2026 (4 domingos, 24 úteis) = 16,67%; mar/2026 (5, 26) = 19,23%. Confirmar a convenção de dia útil (seg–sáb) com o contador.

### T5. Erro explícito
Após `engine.run()`: se `status` começar com `ERRO_CALCULO`, registrar em `errors[]`, **não** gravar holerite e **não** marcar o período como `CALCULATED`; responder 422 com a lista. No motor, incluir código/nome da rubrica na mensagem. **Aceite:** fórmula inválida mantém o período em rascunho.

### T6. Itens do holerite coerentes com os totais
Buscar rubricas 901/902/903 **só por código** (erro se faltarem; todas existem hoje no banco). Validar a invariante antes de gravar: soma dos itens `EARNING` = `total_proventos` e `DEDUCTION` = `total_descontos` (FGTS, tipo `BASE`, fora). **Aceite:** consulta de holerites que não fecham retorna 0 linhas.

### T7. Tabela legal ausente = erro
Sem `legal_versions` vigente, `inss_parameters` (última faixa com limite), `irrf_parameters` (última aberta) ou `general_legal_parameters`: lançar erro. Montar `YYYY-MM-01` sem `toISOString()` (fuso).

### T8. Autenticação e autorização da função
```ts
const authHeader = req.headers.get('Authorization') ?? '';
const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
const { data: { user } } = await userClient.auth.getUser();
if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
// após carregar o período: validar que o usuário pertence a period.tenant_id e tem permissão de cálculo (perfis/RBAC); senão 403
```
Confirmar que a função não está publicada com `--no-verify-jwt`; restringir CORS ao domínio do app; **remover `debug` da resposta**.

### T9. Recálculo atômico
Calcular todos os contratos em memória e persistir em **uma transação** (função Postgres `save_payroll_period(period_id, payload jsonb)` via `rpc`). Travar concorrência (`status = 'CALCULATING'` com `update ... where status <> 'CALCULATING'`).

### T10. Impostos patronais por empresa
Ao final, recalcular totais da empresa a partir de **todos** os `payslips` do período; apagar e inserir uma linha por empresa (também no recálculo por contrato).

### T11. Admissão futura
`if (admDate > fimDoMes) continue;` e tratar `diasTrabalhados <= 0`.

### T12. Rubricas 250/850
Criar por migration/seed; o `index.ts` apenas busca (erro se faltar). Remover insert com `incidencias`/`rubric_type` se essas colunas não existirem.

### T13. Flags de base
Remover `|| r.incidence_inss` das flags `gera_base_*` (conceitos diferentes). Unificar nomes de coluna; usar `??` apenas entre nome antigo/novo da **mesma** flag.

### T14. Eventos fixos e percentuais
`employee_fixed_events.value` vira `manual_value` e sobrepõe a regra. Adicionar `value_type` (`AMOUNT`/`PERCENT`) e enviar como percentual/quantidade quando for o caso. Insalubridade e periculosidade não acumulam: aplicar a maior (configurável).

### T15. Férias que atravessam o mês
Buscar `start_date <= fimDoMes AND end_date >= inicioDoMes`; somar todas as solicitações; sobreposição em dias comerciais (máx. 30), com parse manual de `YYYY-MM-DD`. Definir regra de média de variáveis para a base de férias (501).

### T16. INSS consolidado por competência
```ts
const inssTotal = calc(baseJaTributada + baseAtual) - calc(baseJaTributada);   // calc respeita o teto
```
`baseJaTributada` = bases de INSS de outras folhas do mesmo contrato e competência (regra do 13º à parte). Validar com o contador.

### T17. Descontos fixos por tipo de folha
Padrão: somente `MONTHLY`/`ADVANCE`. Demais por flag `apply_on_types`. Pensão alimentícia tem regra própria (base e dedução de IRRF).

### T18. Hora extra, noturno e DSR
`BASE_HORA_EXTRA` = salário + adicionais habituais; `BASE_DSR` inclui noturno e variáveis com `integra_dsr`; hora noturna reduzida (52min30s) e prorrogação; DSR sobre faltas (803); hora extra sem fator cadastrado = erro (hoje assume 1,5); remover fallback `percentage = 20`.

### T19. Demais regras
Dependentes por idade/vigência e sem duplicidade entre declarantes (usar `birth_date`; trazer `person_id` no select dos contratos); 13º com médias/faltas e confirmação do redutor/simplificada na tributação exclusiva; FGTS por `fgts_standard_aliquot`/`fgts_apprentice_aliquot`; patronais por regime (Simples/desoneração) e flags `inss_patronal/rat/terceiros` das rubricas; gravar `engine_version` e o `legal_versions.id` real (hoje fixos `'1.0.0'`/`'2026.1'`).

### T20. Teste de rescisão
Investigar `Termination.test.ts` (esperado 3000, obtido 1920); corrigir motor **ou** teste com justificativa.

### T21. Dinheiro sem `float`
`money.ts` com política única (HALF_UP, 2 casas por rubrica e por imposto) usando centavos inteiros ou `decimal.js`. Provisório: `round2 = n => Math.round((n + Number.EPSILON)*100)/100`. **Aceite:** teste de propriedade `líquido = proventos − descontos` exato em 1.000 casos.

### T22. `kind` explícito
Migration `payroll_rubrics.rubric_kind` (`SALARY_BASE, OVERTIME, DSR, DSR_NOTURNO, ADIC_NOTURNO, INSALUBRIDADE, PERICULOSIDADE, ABSENCE, LATE, COMMISSION, OTHER...`) com backfill; campo obrigatório em `Rubrics.tsx`; motor usa `kind`; heurísticas antigas só como fallback com `console.warn` e depois removidas. Corrigir a precedência de `isAdicionalNoturno` e exigir `type === 'EARNING'` em overtime/insalubridade/periculosidade. Trocar `category === 'SALARY'` por `kind`.

### T23. DAG real
Dependências também por fórmula (`R\d+`/códigos) e por bases dinâmicas: rubricas com base `BASE_DSR` dependem de `OVERTIME`/`COMMISSION`/`ADIC_NOTURNO`; `BASE_DSR_NOTURNO` de `ADIC_NOTURNO`; `BASE_HORA_EXTRA` dos adicionais habituais. `calculation_order` obrigatório; ciclo com código e nome.

### T24. Parser de fórmulas
Resolver variáveis **na AST** (sem substituição textual por regex); tokenizer estrito (caractere desconhecido = erro); suportar `> < >= <= == != && ||` e `.5`; normalizar vírgula decimal; variável inexistente = erro (exceto código de rubrica existente não acionada); divisão por zero/`NaN` = erro; não registrar variável só com o código numérico (colide com constantes como `220`); registrar `R{code}` também com valor 0.

### T25. Outros
`getVariable` erro para nome inexistente; `calculation_order ?? 100`; eventos negativos/zero (estornos); política para líquido negativo; carregar deduções/eventos/benefícios/dependentes **filtrados pelos contratos do período** (hoje tenant inteiro); atualizar `deno std@0.168.0` e `supabase-js@2.38.0`.

### T26. eSocial simulado
`forceTransmission` marca `ACCEPTED` com `Math.random`. **Imediato:** rotular "Simulação: não transmite", desativar o botão em produção e remover/anular registros com recibos fictícios (preservando trilha). Transmissão real = Fase P10.

### T27. RPC de assinatura insegura
`sign_worker_document(p_document_id, p_worker_id)` é `SECURITY DEFINER`, não valida `auth.uid()`, aceita qualquer `worker_id`, não grava `signatures_log` e não vincula hash. Substituir pelo fluxo da seção 8 (AS-01 a AS-12) e **revogar** a RPC atual.

### T29. Auditoria ampliada
Adicionar `audit.audit_trigger_func()` em `payslips`, `payslip_items`, `payroll_periods`, `payroll_memory_calc`, `employee_deductions`, `employee_fixed_events`, `legal_versions`, `inss_parameters`, `irrf_parameters`, `general_legal_parameters`, `payroll_variable_events`, `time_*`, `signatures_log`. Logs sem UPDATE/DELETE.

---

## 5. Catálogo de rubricas (T30)

### 5.1 O que o banco mostrou
- 41 rubricas; **só 101, 150, 160 e 170 têm incidências**; a maioria tem `calculation_form` nulo.
- **Fora das bases:** adicionais (301–304), comissões/gratificações/prêmio (401–403), férias/1/3 (501–504), 13º (601), DSR (103/104/171), saldo (701).
- **Faltas/atrasos (801–803)** não reduzem as bases.
- **DSR provavelmente em duplicidade:** 103 e 104 caem ambas na regra de DSR do motor (por nome/código) e calculam automaticamente; 171 por código (noturno). A 170 tem categoria `OVERTIME`, logo o motor a trata como hora extra e ela não calcula como DSR. *Confirmar com simulação.*
- **HE 60% (151)** sem forma de cálculo/fator (motor assume 1,5). Confirmar o `factor` das 150 (1,5) e 160 (2,0).
- Existem 901/902/903 e o salário (101) tem categoria `SALARY` e forma `FIXO` (correto).
- **Ausentes:** salário-família, pensão alimentícia, consignado, contribuição sindical/assistencial, penosidade, banco de horas, HE 70%.

### 5.2 Matriz de incidência proposta (validar com o contador)
| Rubricas | INSS | IRRF | FGTS |
|---|---|---|---|
| Salário (101), função (107), adicionais (301–304), comissão/gratificação (401/402), HE (150/151/160), DSR (103/104/170/171), férias e 1/3 (501/502), saldo (701) | sim | sim | sim |
| Prêmio (403), salário-maternidade (105) | definir | definir | definir |
| PLR (404) | não | sim (tabela própria) | não |
| 13º (601) | sim (2ª parcela) | sim (exclusivo) | sim |
| Adiantamento 13º (602) | não | não | sim |
| Abono (503) e 1/3 (504) | não | confirmar | não |
| Aviso indenizado (707) | não | não | sim |
| Faltas, atrasos, DSR s/ falta (801–803) | reduzem | reduzem | reduzem |
| VT, VR/VA, planos, adiantamentos (201–204, 250, 850, 608), multa FGTS (708) | não | não | não |

### 5.3 Ações
Migration de ajuste (incidências, `calculation_form`, `factor`, `calculation_order`), desativação de duplicidades (103/104), criação das rubricas ausentes, e relatório "rubricas sem incidência/forma definida". **Antes:** rodar a consulta de parâmetros:
```sql
select code, name, calculation_order, calculation_form, calculation_base,
       factor, percentage, divisor, formula, is_active
from payroll_rubrics order by code;
```

---

## 6. Motor orientado a dados e criação de rubricas

**Princípio:** a regra vive na definição da rubrica (dado versionado e homologado); o motor interpreta e nunca decide por nome ou código.

### 6.1 Modelo (esboço)
```sql
-- payroll_rubrics ganha: kind, esocial_nature, is_system, version, valid_from, valid_to,
--   status (DRAFT|APPROVED|ACTIVE|RETIRED), legal_basis, approved_by, approved_at
create table rubric_incidences (
  rubric_id uuid references payroll_rubrics, context text,   -- MONTHLY|VACATION|THIRTEENTH|TERMINATION
  inss bool, irrf bool, fgts bool, irrf_mode text,           -- NORMAL|EXCLUSIVO|TABELA_PLR
  integra_dsr bool, media_ferias bool, media_13 bool,
  inss_patronal bool, rat bool, terceiros bool,
  primary key (rubric_id, context));
create table calculation_bases (code text primary key, name text);              -- BASE_DSR, BASE_HORA_EXTRA, BASE_FERIAS...
create table calculation_base_members (base_code text, rubric_id uuid, kind text);
-- payslip_items ganha rubric_version_id
```

### 6.2 Camadas
1. **Estruturais (`is_system`)**: protegidas (salário, INSS, IRRF, FGTS, DSR, HE, adicionais legais, férias, 13º, rescisórias).
2. **Do cliente**: criadas na tela (gratificações, convênios, CCT/ACT).
3. **Informativas/bases**: não alteram o líquido.

### 6.3 Fluxo "Nova rubrica" (situação nova)
1. Escolher **modelo** (adicional %, valor fixo, horas × fator, comissão, gratificação, desconto fixo/percentual, PLR, indenização, benefício).
2. Assistente sugere **incidências pela natureza eSocial** (Tabela 03), com justificativa; usuário confirma e informa a **base legal** (lei, CCT/ACT, política).
3. **Simulador** com colaborador de teste (memória de cálculo, bases, impacto no líquido).
4. **Validações:** ciclo, variável inexistente, incidência incoerente com a natureza, duplicidade.
5. **Aprovação:** `DRAFT → APPROVED → ACTIVE` com data de vigência; rubrica ativa é **imutável** (alterar = nova versão).
6. Holerites antigos continuam apontando para a versão antiga.

**Interpretação pelo motor:** `kind` conhecido → estratégia testada (só configuração); comportamento novo → fórmula segura sobre **variáveis publicadas** (listadas na tela); regra estrutural nova → novo `kind` com código, teste e homologação.

---

## 7. Módulo de Ponto Eletrônico (novo)

**É possível.** Três origens de marcação convergem para uma única trilha imutável: **(a)** relógio Control iD (REP), **(b)** importação de arquivo (AFD), **(c)** aplicativo no celular (PWA). Sobre elas rodam tratamento, banco de horas, espelho e fechamento para a folha.

### 7.1 Requisitos legais (a confirmar com a advogada/especialista)
Referências: CLT arts. 58 (tolerância), 59 (banco de horas), 66, 71, 73, 74 (controle de jornada); **Portaria MTP 671/2021** (REP-C, REP-A, **REP-P**), com **AFD** (Arquivo-Fonte de Dados), **AEJ** (Arquivo Eletrônico de Jornada), comprovante de registro e espelho de ponto. O ponto por aplicativo se enquadra como **REP-P** (programa) e exige: numeração sequencial (NSR), hora de fonte confiável, **comprovante ao empregado**, impossibilidade de alterar a marcação original, exportação de AFD/AEJ e documentação do fornecedor (**atestado técnico e termo de responsabilidade**). Banco de horas: acordo individual escrito (compensação até 6 meses) ou ACT/CCT (até 1 ano). **Validar cada item antes de produção.**

### 7.2 Modelo de dados
```sql
create table time_devices (          -- relógios e fontes
  id uuid pk, tenant_id uuid, company_id uuid,
  kind text check (kind in ('REP_C','REP_P_MOBILE','IMPORT')),
  vendor text, model text, serial_number text, host text,        -- host só para o coletor local
  last_nsr bigint default 0, last_sync_at timestamptz, status text, api_key_hash text);

create table afd_files (id uuid pk, tenant_id uuid, device_id uuid, file_hash text unique,
  period_start date, period_end date, uploaded_by uuid, created_at timestamptz);

create table time_punch_records (    -- trilha IMUTÁVEL (sem UPDATE/DELETE)
  id uuid pk, tenant_id uuid, company_id uuid, device_id uuid,
  nsr bigint not null, record_type int, punched_at timestamptz not null,   -- com fuso
  cpf text, worker_id uuid, source text check (source in ('REP','MOBILE','IMPORT','MANUAL')),
  geo jsonb, ip inet, device_fingerprint text, receipt_code text, raw_line text, crc_ok boolean,
  unique (device_id, nsr));
```
`time_entries` passa a referenciar `punch_record_id` (marcação **original**); correções vão em `time_entry_adjustments` com motivo, autor e aprovação. Estender `time_bank_accounts` com política (`ACORDO_INDIVIDUAL|CCT`, prazo, regra de vencimento) e criar `time_daily_summary` (por contrato/dia: trabalhado, extras, noturno, atrasos, faltas, intervalos, violações de interjornada/intrajornada, status). Gatilhos bloqueando UPDATE/DELETE em `time_punch_records`, e auditoria.

### 7.3 Integração com o relógio Control iD
- Relógios ficam na **rede local** da empresa; Vercel/Supabase na nuvem **não alcançam IP privado**. Soluções, da mais simples à mais completa:
  1. **PT-02 Importação manual de AFD** (universal, independe de modelo): upload do arquivo, validação e ingestão. É o **primeiro entregável**.
  2. **PT-03 Coletor local (agente)**: serviço leve (Node/Docker/Windows) na rede do cliente que consulta o REP **incrementalmente por NSR** pela API do equipamento e envia lotes por HTTPS à Edge Function `time-ingest`, com chave por dispositivo, assinatura HMAC, retentativa e fila offline.
  3. **Push do relógio** (se o modelo suportar envio de eventos a um endpoint HTTPS): a Edge Function recebe diretamente.
- **Confirmar na documentação oficial da Control iD** o modelo em uso (ex.: iDClass/iDFlex), versão de firmware, autenticação por sessão e as rotas de exportação de AFD/eventos e de cadastro de usuários. Cadastro de colaboradores no relógio (CPF/PIS/matrícula, biometria/cartão) deve ser sincronizado a partir do CoupleRH.
- **Parser de AFD** conforme o layout da Portaria 671/2021: cabeçalho, identificação do empregador, marcações, ajustes de relógio, inclusão/alteração de empregados e eventos sensíveis; validar **NSR sem lacunas**, CRC/hash e CNPJ/CPF; idempotente por `(device_id, nsr)`; ingestão com relatório (aceitas, duplicadas, rejeitadas e motivo).

### 7.4 Ponto pelo celular (PWA, REP-P)
- Edge Function `time-punch`: exige JWT do colaborador; **carimba hora no servidor** (nunca confiar no relógio do aparelho); gera **NSR sequencial** por empresa (transação/sequence); registra IP, geolocalização (com precisão) e fingerprint; valida **geofence** dos locais de trabalho (`workplaces` com latitude/longitude/raio) e regras por colaborador (externo, home office); bloqueio de marcações repetidas em curto intervalo.
- **Comprovante** a cada marcação (tela + PDF com NSR, hash, data/hora, empresa, colaborador, QR de verificação).
- Selfie/biometria **opcional e só com base legal e consentimento** (dado sensível, LGPD); política de retenção.
- Marcação offline: **não** aceitar como oficial (sem hora confiável); apenas fila de "justificativa" para tratamento posterior.

### 7.5 Tratamento, banco de horas e espelho
- Motor de jornada (`time-process`): tolerâncias (art. 58 §1º), arredondamentos configuráveis, adicional noturno, intervalos, interjornada, feriados/DSR, escalas 12x36; resultado em `time_daily_summary`; **ponto por exceção** (só pendências exigem ação).
- **Banco de horas:** créditos/débitos automáticos, extrato diário, saldo, vencimento por política, alertas de vencimento, compensação (folga), pagamento do saldo vencido como HE na folha e **termo do acordo** assinado (seção 8). **O colaborador vê saldo e extrato no portal.**
- **Espelho de ponto** mensal (PDF) com assinatura do colaborador e fluxo de **contestação** (o colaborador contesta marcações em prazo definido; gestor/DP responde; tudo auditado).
- **Fechamento do ponto → folha:** substituir o lançamento manual de `Timesheet.tsx` por geração automática de eventos variáveis (HE 50/100, noturno, faltas, atrasos, DSR) com rastreio da origem (`time_period_closure_id`).
- **Exportações de fiscalização:** AFD, AEJ, espelho e comprovantes por período.

### 7.6 Telas
Colaborador (portal/PWA): marcar ponto, comprovantes, espelho, **banco de horas**, justificativas/ajustes, assinaturas pendentes. Gestor: aprovações, ocorrências, equipe. DP: dispositivos, importações, tratamento, inconsistências, fechamento, exportações, parâmetros de jornada/banco.

### 7.7 Itens (referenciados no `fase.md`)
PT-01 modelagem e migrations · PT-02 importação AFD · PT-03 coletor local Control iD · PT-04 endpoint `time-ingest` · PT-05 `time-punch` (celular) + comprovante · PT-06 motor de jornada · PT-07 banco de horas (política, extrato, vencimentos) · PT-08 espelho + contestação · PT-09 fechamento → folha · PT-10 portal do colaborador (ponto/banco) · PT-11 telas de DP/gestor · PT-12 exportações AFD/AEJ · PT-13 segurança/LGPD do ponto · PT-14 testes (jornadas, noturno, 12x36, feriados, banco de horas).

---

## 8. Módulo de Assinatura Digital de Documentos (novo)

**É possível.** O colaborador assina **na tela** (rubrica desenhada), e a rubrica é **estampada no PDF** junto de uma página de evidências. Documentos: holerite, recibo de férias, aviso de férias, espelho de ponto, termo de banco de horas, TRCT, políticas e contratos.

### 8.1 Níveis de assinatura (Lei 14.063/2020; ICP-Brasil: MP 2.200-2/2001)
- **Simples:** identificação por login. **Avançada:** vincula ao signatário com evidências verificáveis (é o alvo para holerite, recibos, aviso e espelho). **Qualificada:** certificado ICP-Brasil (reservar para rescisão/TRCT e quando exigido; pode usar serviço externo como Clicksign/D4Sign/Autentique).
- A força probatória cresce com autenticação reforçada (login + **OTP**), hash, carimbo de tempo, trilha de evidências e **selo de integridade** do PDF. **Validar com a advogada** o nível exigido por tipo de documento.

### 8.2 Falhas atuais a eliminar
RPC `sign_worker_document` troca status sem verificar quem chama, sem hash/IP/log (T27); holerite em PDF é gerado **no navegador** (`jsPDF` no portal), então não há original imutável; `signatures_log` não guarda a rubrica nem evidências.

### 8.3 Fluxo
1. **Geração no servidor** do PDF a partir de um **snapshot** imutável (holerite de folha **fechada**, férias, espelho): hash **H1** gravado e documento travado.
2. **Notificação** ao colaborador (portal/e-mail/WhatsApp) e registro de entrega.
3. **Leitura:** abre o documento; registrar visualização (páginas vistas/tempo).
4. **Consentimento + autenticação:** "li e concordo" + **OTP** (e-mail/SMS/WhatsApp) ou PIN; opção **"Discordo/Contesto"** com motivo (indispensável para holerite e espelho).
5. **Rubrica na tela:** canvas (ex.: `signature_pad`), guardando **traços (JSON) + PNG** em Storage privado.
6. **Servidor (Edge Function `sign-document`)** valida sessão (`auth.uid()` ↔ `worker`), status do documento e `H1` inalterado; grava `signatures_log` (IP, user agent, geolocalização se consentida, data/hora do servidor, `H1`, método de autenticação, id da rubrica); **estampa a rubrica no PDF** (`pdf-lib`), anexa a **página de manifesto** (signatário, CPF mascarado, IP, data/hora, hashes, QR de verificação) e calcula **H2**; trava o documento.
7. **Cópias:** colaborador e empresa baixam o PDF assinado; **página pública de verificação** (`/verificar/:codigo`) confere H2.
8. **Selo de integridade** (etapa 2): assinatura PAdES do PDF com certificado A1 da empresa (serviço Node dedicado) e/ou carimbo de tempo ICP-Brasil.

### 8.4 Regras por documento
- **Holerite:** só após fechamento; versão assinada vinculada à versão do holerite; reabertura da folha invalida e gera nova versão.
- **Recibo de férias e aviso de férias:** alerta de prazo (aviso com antecedência mínima e pagamento antecipado, CLT arts. 135 e 145: **confirmar**); a data da ciência fica registrada.
- **Espelho de ponto:** ciência/contestação, vinculada ao fechamento do ponto.
- **Termo de banco de horas:** acordo individual escrito, com versão e vigência.

### 8.5 Modelo de dados (esboço)
```sql
alter table employee_documents add column doc_type text, add column source_ref uuid,   -- payslip_id, vacation_id, timesheet_id...
  add column hash_original text, add column hash_signed text, add column signed_file_url text,
  add column due_at timestamptz, add column version int default 1;
alter table signatures_log add column auth_method text, add column geo jsonb,
  add column signature_png_url text, add column signature_strokes jsonb,
  add column decision text check (decision in ('SIGNED','CONTESTED','REFUSED')), add column reason text;
create table document_events (id uuid pk, document_id uuid, event text, at timestamptz, ip inet, ua text, meta jsonb); -- enviado, visualizado, lembrete...
```
RLS: colaborador vê apenas os seus; Storage com **URLs assinadas de curta duração**; `signatures_log` e `document_events` somente inserção.

### 8.6 Itens
AS-01 modelagem · AS-02 geração de PDF no servidor (snapshot + hash) · AS-03 pad de assinatura (PWA e desktop) · AS-04 `sign-document` · AS-05 estampa + manifesto + H2 · AS-06 OTP/PIN · AS-07 notificações/lembretes · AS-08 verificação pública · AS-09 painel de pendências e relatórios · AS-10 holerite/recibo/aviso/espelho/termo (templates e regras) · AS-11 contestação/recusa · AS-12 selo A1/carimbo (etapa 2) e revogação da RPC antiga.

---

## 9. Segurança, LGPD e auditoria

- **Autenticação/autorização:** T8; RBAC granular (DP, gestor, contador, auditor somente leitura, colaborador); revisão de **todas** as políticas RLS com testes automatizados de acesso entre tenants.
- **Auditoria:** T29; logs imutáveis; relatório "quem alterou o quê".
- **Dados sensíveis** (salário, CPF, saúde/SST, biometria/geolocalização): criptografia de colunas críticas, máscara em tela/log, retenção, trilha de acesso, atendimento a direitos do titular, base legal e consentimento registrados (`lgpd_consents`).
- **Segredos:** nada de `service_role` no cliente; chaves por dispositivo no coletor; rotação.
- **Infra:** CORS restrito, rate limit nas Edge Functions, backups com PITR e **teste de restauração documentado**.

---

## 10. Qualidade, ambientes e homologação

- **Ambientes:** dev, staging, produção (projetos/branches Supabase separados; deploys Vercel por ambiente).
- **CI obrigatório:** lint, tipos, `vitest` (incluindo golden files), validação de migrations; sem deploy do motor com teste vermelho.
- **Golden files:** 30+ holerites reais conferidos pelo contador; divergência vira teste permanente.
- **Testes obrigatórios:** integração motor + calculadoras (tabela T1); INSS nos limites (1.621,00 / 2.902,84 / 4.354,27 / 8.475,55 / acima do teto); IRRF em 2.428,80 / 5.000,00 / 5.000,01 / 7.350,00 / 7.350,01 com 0, 1 e 3 dependentes; DSR por mês; proporcionalidade (admissão dias 1/15/31, fevereiro, férias); duas folhas seguidas (T2); invariantes (itens = totais, bases ≥ 0, idempotência); ponto (noturno, 12x36, feriados, banco de horas); assinatura (hash antes/depois, adulteração detectada).
- **Homologação paralela:** 2 a 3 competências calculadas no CoupleRH **e** no processo oficial; tolerância R$ 0,00 por rubrica (ou política de centavos formalizada); ata assinada pelo contador.
- **Observabilidade:** Sentry/logs estruturados, alerta de falha de folha e de ingestão de ponto.
- **Operação do cálculo:** lote com fila, idempotência, trava por período e versão do motor gravada em cada holerite.

---

## 11. Governança e conformidade

1. Contador/consultor trabalhista **responsável** por homologar tabelas, rubricas e regras (ata por competência).
2. **Matriz de rastreabilidade:** regra → base legal → rubrica → teste.
3. **Manual de política de cálculo** (arredondamento, bases, ordem, médias, versões).
4. **Calendário anual** de atualização de INSS/IRRF/salário mínimo (versão com vigência, nunca sobrescrita).
5. **Relatório de conformidade** gerado pelo sistema (rubricas sem incidência, folhas com erro, tabelas vencidas, assinaturas pendentes, marcações inconsistentes).
6. Evidências para o jurídico: documentação de arquitetura, atestado técnico do REP-P, política de retenção, trilha de auditoria.

---

## 12. Roadmap, estimativas e dependências

Estimativas **grosseiras** para 1 a 2 desenvolvedores com apoio de IA; dependem da disponibilidade do contador e da advogada.

| Fase (`fase.md`) | Conteúdo | Estimativa |
|---|---|---|
| P0 | Contenção (T8, T5, T26, T27 revogação provisória, rotulagem) | 1 semana |
| P1 | Correções do motor T1–T4, T6, T7, T11 | 2 semanas |
| P2 | Catálogo e incidências (T30), T12, T13 | 1–2 semanas |
| P3 | Integridade e motor orientado a dados (T9, T10, T21–T25), criação de rubricas | 3–4 semanas |
| P4 | Regras trabalhistas (T14–T20) | 3–4 semanas |
| P5 | **Ponto** (PT-01 a PT-14) | 8–12 semanas (AFD+celular+banco de horas em ~6) |
| P6 | **Assinatura** (AS-01 a AS-12) | 4–6 semanas |
| P7 | Pré-folha, fechamento, guias, relatórios | 3–4 semanas |
| P8 | Segurança, LGPD, auditoria, RBAC (T29) | contínuo, marcos nas semanas 4 e 12 |
| P9 | Qualidade, CI, ambientes, homologação paralela e checklist de go-live | 3 semanas + paralelo |
| P10 | eSocial real (serviço dedicado/parceiro) | 8–12 semanas, pós go-live |

**Dependências:** P1 → P2 → P3/P4; P5 depende de decisão sobre o modelo de relógio e do coletor; P6 depende de P5 (espelho) e P7 (holerite fechado); P9 depende de tudo.

---

## 13. Riscos, premissas e limites

- **Homologação humana é o gargalo real**; sem contador validando, não há garantia de conformidade.
- **Mudança legal** exige revisão de regras, não só de tabelas.
- **REP-P** tem requisitos formais; sem atestado técnico e conformidade, o ponto por celular pode ser questionado. Alternativa: usar apenas REP-C (Control iD) até regularizar.
- **Control iD:** integração depende de modelo/firmware e de rede do cliente; AFD manual é o plano B universal.
- **Assinatura:** validade e valor probatório dependem do nível adotado; o jurídico define o nível por documento.
- **Prazo:** o escopo total não cabe "em breve". Recomenda-se go-live por ondas e **conferência manual do contador** na folha até o fim da homologação paralela.

---

## Anexo A. Consultas de verificação (Fase 0)
```sql
select column_name from information_schema.columns where table_name='payroll_rubrics' order by 1;
select code,name,type,category,calculation_form,calculation_base,factor,percentage,divisor,formula,calculation_order,is_active
  from payroll_rubrics order by code;
select * from legal_versions order by valid_from desc;
select version_id,bracket_number,base_limit,aliquot from inss_parameters order by 1,2;
select version_id,bracket_number,base_limit,aliquot,deduction from irrf_parameters order by 1,2;
select * from general_legal_parameters;
select p.id from payslips p where p.status='CALCULATED' and p.total_earnings=0 and p.net_salary=0;
select p.id, p.total_earnings, p.total_deductions,
  coalesce(sum(i.amount) filter (where i.type='EARNING'),0) itens_prov,
  coalesce(sum(i.amount) filter (where i.type='DEDUCTION'),0) itens_desc
from payslips p left join payslip_items i on i.payslip_id=p.id group by p.id
having abs(p.total_earnings-coalesce(sum(i.amount) filter (where i.type='EARNING'),0))>0.01
    or abs(p.total_deductions-coalesce(sum(i.amount) filter (where i.type='DEDUCTION'),0))>0.01;
select * from esocial_transmissions where receipt_number like '1.2.000%';   -- recibos fictícios (T26)
select proname, prosecdef from pg_proc where proname in ('sign_worker_document','get_worker_signatures'); -- T27
```

## Anexo B. Referências legais a conferir
CLT (arts. 58, 59, 66, 71, 73, 74, 129–145, 477); Portaria MTP 671/2021 (REP-C/REP-A/REP-P, AFD, AEJ); Lei 14.063/2020 e MP 2.200-2/2001; LGPD (Lei 13.709/2018); Lei 15.270/2025 (IRRF 2026); tabelas INSS/IRRF/salário mínimo 2026; eSocial (S-1.3) e Tabela 03 de natureza de rubricas; CCT/ACT da categoria.
