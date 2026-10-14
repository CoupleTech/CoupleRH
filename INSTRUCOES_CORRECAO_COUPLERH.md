# INSTRUÇÕES DE CORREÇÃO: CoupleRH (Motor de Folha)

**Para:** desenvolvedor ou agente de código (ex.: Claude Code) com acesso ao repositório.
**Base:** código do `payroll-engine` colado do Supabase (parece idêntico ao repositório `CoupleTech/CoupleRH`, commit `fbe14fa`; a única diferença visível é o comentário `FORCE DEPLOY TIMESTAMP`). Não tive acesso ao banco: os itens da Fase 0 devem ser rodados por você.
**Valores legais 2026** (faixas, redutor, R$ 607,20, teto etc.) vêm de memória e **devem ser validados por contador ou nas fontes oficiais** antes de produção.

## Regras de execução
1. Uma tarefa = um commit. Rodar `npx vitest run` antes e depois. Hoje 26/27 passam (falha `Termination.test.ts`, esperado 3000, obtido 1920; ver T20).
2. Escrever o teste da tarefa **antes** da correção (seção "Aceite").
3. Não mexer em tabelas legais por código: valores legais só vêm de `general_legal_parameters`, `inss_parameters`, `irrf_parameters`.
4. Após cada fase, recalcular uma competência de teste e comparar com holerites conferidos por contador.

---

## FASE 0: Verificações no banco (antes de mexer no código)

```sql
-- 0.1 Colunas e flags de base das rubricas (nomes divergem entre tela e motor)
select column_name from information_schema.columns where table_name = 'payroll_rubrics' order by 1;
select code, name, type, category, calculation_form, calculation_base,
       generates_inss_base, generates_irrf_base, generates_fgts_base,
       incidence_inss, incidence_irrf, incidence_fgts
from payroll_rubrics order by code;   -- ajuste nomes conforme 0.1a

-- 0.2 Rubrica de salário: categoria precisa ser 'SALARY' (senão não há proporcionalidade)
select code, name, category, calculation_form from payroll_rubrics
where code in ('101','1001') or name ilike '%salário base%' or name ilike '%salario base%';

-- 0.3 Tabelas legais
select * from legal_versions order by valid_from desc;
select version_id, bracket_number, base_limit, aliquot from inss_parameters order by 1,2;   -- última faixa DEVE ter base_limit
select version_id, bracket_number, base_limit, aliquot, deduction from irrf_parameters order by 1,2; -- última faixa DEVE ser aberta (null)
select * from general_legal_parameters;   -- conferir nomes: dependent_deduction, simplified_discount, minimum_wage, irrf_*

-- 0.4 Rubricas automáticas existem? (901 INSS, 902 IRRF, 903 FGTS)
select code, name, type from payroll_rubrics where code in ('901','902','903');

-- 0.5 Códigos de rubrica numéricos que colidem com constantes em fórmulas
select code, name from payroll_rubrics where code ~ '^[0-9]+$' and code::int in (12, 30, 100, 220);

-- 0.6 Holerites zerados em folha CALCULATED (sintoma de erro engolido, T5)
select p.id, p.contract_id, p.period_id from payslips p
where p.status = 'CALCULATED' and p.total_earnings = 0 and p.net_salary = 0;

-- 0.7 Holerites cujos itens não fecham com os totais (sintoma de T6)
select p.id, p.total_earnings, p.total_deductions,
  coalesce(sum(i.amount) filter (where i.type='EARNING'),0)   as itens_prov,
  coalesce(sum(i.amount) filter (where i.type='DEDUCTION'),0) as itens_desc
from payslips p left join payslip_items i on i.payslip_id = p.id
group by p.id
having abs(p.total_earnings  - coalesce(sum(i.amount) filter (where i.type='EARNING'),0))   > 0.01
    or abs(p.total_deductions - coalesce(sum(i.amount) filter (where i.type='DEDUCTION'),0)) > 0.01;

-- 0.8 Significado do valor em lançamentos fixos (R$ ou %?), ver T14
select fe.value, fe.quantity, r.code, r.name, r.calculation_form
from employee_fixed_events fe join payroll_rubrics r on r.id = fe.rubric_id limit 30;
```
**Ação:** corrigir cadastros que a Fase 0 apontar (última faixa do INSS sem limite, categoria do salário, rubricas 901/902/903 ausentes) **antes** da Fase 1.

---

## FASE 1: Erros de valor (maior impacto financeiro)

### T1. IRRF calculado sobre base já sem INSS (CRÍTICO)
**Arquivos:** `engine/PayrollEngine.ts` (bloco "4. Cálculos Legais"), `legal/IRRFCalculator.ts`.
**Problema:** o motor faz `base_irrf -= inss` e chama o calculador com `inss = 0`. A simplificada (R$ 607,20) passa a ser `bruto − INSS − 607,20` e o redutor usa a base líquida. IRRF retido a menos (ex.: bruto R$ 6.000: sistema R$ 132,71; correto ≈ R$ 385,10).
**Correção (motor):**
```ts
// guardar ANTES de calcular o INSS
const baseIrrfBruta = this.context.base_irrf;

inssResult = INSSCalculator.calculate(this.context.base_inss, this.context.inss_parameters);
if (inssResult.value > 0) {
  this.context.total_descontos += inssResult.value;
  // REMOVER: this.context.base_irrf -= inssResult.value;
  /* memória do INSS permanece */
}
const dependentes = this.context.getVariable('DEPENDENTES') || 0;
irrfResult = IRRFCalculator.calculate(
  baseIrrfBruta, inssResult.value, dependentes,
  this.context.irrf_parameters, this.context.general_legal_parameters);
// no retorno: bases.irrf = irrfResult.legalBase (base de cálculo pós-deduções); guardar a bruta na memória
```
**Correção (calculador):**
```ts
public static calculate(rendimentoTributavel: number, inss: number, dependents: number,
    brackets: IrrfBracket[], params: GeneralLegalParameters) {
  if (params.dependent_deduction == null || params.simplified_discount == null)
    throw new Error('Parâmetros legais de IRRF ausentes (dependent_deduction / simplified_discount)');
  const baseLegal = rendimentoTributavel - inss - dependents * params.dependent_deduction /* - pensão dedutível */;
  const baseSimpl = rendimentoTributavel - params.simplified_discount;
  const usedSimplified = baseSimpl < baseLegal;
  const calcBase = Math.max(0, usedSimplified ? baseSimpl : baseLegal);

  const sorted = [...brackets].sort((a, b) => a.bracket_number - b.bracket_number);
  let irrf: number | null = null;
  for (const b of sorted) {
    if (calcBase <= (b.base_limit ?? Infinity)) { irrf = calcBase * b.aliquot / 100 - b.deduction; break; }
  }
  if (irrf === null) throw new Error('Tabela IRRF sem faixa aplicável (última faixa deve ser aberta)');
  irrf = Math.max(0, irrf);

  // Redutor 2026 sobre o RENDIMENTO BRUTO; valores vêm dos parâmetros (T3)
  const p = params;
  if (rendimentoTributavel <= p.irrf_exemption_limit!) irrf = Math.max(0, irrf - p.irrf_base_reduction!);
  else if (rendimentoTributavel <= p.irrf_reduction_formula_limit!)
    irrf = Math.max(0, irrf - Math.max(0, p.irrf_reduction_a! - p.irrf_reduction_b! * rendimentoTributavel));
  return { value: round2(irrf), usedSimplified, legalBase: calcBase };
}
```
**Aceite (teste de integração motor + calculador, sem dependentes, salário como única rubrica com incidências):**

| Bruto | INSS | IRRF esperado |
|---|---|---|
| 5.000,00 | 501,51 | 0,00 |
| 5.300,00 | 543,51 | 108,84 |
| 6.000,00 | 641,51 | 385,10 |
| 7.000,00 | 781,51 | 754,75 |
| 7.350,00 | 830,51 | 884,13 |
| 12.000,00 | 988,09 | 2.119,55 |

(Confirmar no simulador da Receita/contador; arredondamentos podem variar em ±0,01.)

### T2. Rubricas compartilhadas e mutadas entre colaboradores
**Arquivo:** `index.ts` (dentro de `for (const contract of contracts)`, antes de `new PayrollContext`).
**Problema:** `rubricas.filter(...)` devolve os **mesmos objetos**; o motor grava `percentage`, `factor`, `calculation_base` neles (DSR de um colaborador vaza para o próximo).
**Correção:**
```ts
applicableRubrics = applicableRubrics.map(r => structuredClone(r));
```
No `PayrollEngine`, também parar de escrever em `rubric.*`: trabalhar com variáveis locais (`let percentage = rubric.percentage`, etc.).
**Aceite:** teste rodando 2 contratos (dias úteis diferentes) na mesma lista de rubricas: DSR do 2º não herda o percentual do 1º.

### T3. Parâmetros legais chumbados e `salario_minimo` não enviado
**Arquivos:** `index.ts`, `PayrollContext.ts`, `IRRFCalculator.ts`, `INSSCalculator.ts`, migration nova.
**Passos:**
1. No `contextData`: `salario_minimo: general_legal_parameters.minimum_wage` (falhar se ausente).
2. Migration: adicionar em `general_legal_parameters` as colunas `irrf_reduction_a numeric` (978.62) e `irrf_reduction_b numeric` (0.133145); confirmar/preencher `irrf_exemption_limit` (5000), `irrf_reduction_formula_limit` (7350), `irrf_base_reduction` (312.89), `dependent_deduction`, `simplified_discount`. Atualizar `Settings/LegalTables/Form.tsx` e a interface `GeneralLegalParameters`.
3. **Remover todos os fallbacks 2026 embutidos** (`INSSCalculator`, `IRRFCalculator`, `PayrollContext: salario_minimo || 1621`). Sem tabela para a competência = erro explícito (T7).
4. `PayrollContext`: `HORAS_TRABALHADAS` deve usar `divisor` (hoje fixo 220); `DIAS_UTEIS`/`DIAS_INUTEIS` usar os mesmos valores dos campos (hoje `|| 26` transforma 0 em 26).
**Aceite:** alterar `simplified_discount` no cadastro muda o resultado; competência sem versão legal falha com mensagem clara.

### T4. DSR distorcido pela "normalização para 30 dias"
**Arquivo:** `index.ts` (bloco "Normaliza para 30 dias").
**Problema:** força `dias_uteis + dias_inuteis = 30`. Fev/2026: DSR 15,38% (correto 16,67%); mar e mai/2026: 20,00% (correto 19,23%).
**Correção:** apagar o bloco `if (dias_uteis + dias_inuteis > 30) ... else if (< 30) ...`. A proporcionalidade do salário continua em base 30 (`dias_trabalhados`), o DSR usa dias reais.
**Aceite:** fev/2026 (4 domingos, 24 úteis) → 16,67%; mar/2026 (5 domingos, 26 úteis) → 19,23%. Confirmar com o contador a convenção de "dia útil" (seg–sáb) para a jornada da empresa.

### T5. Erro de cálculo vira holerite zerado "CALCULADA"
**Arquivos:** `index.ts`, `PayrollEngine.ts`.
**Problema:** o `catch` do motor devolve totais zerados com `status: 'ERRO_CALCULO: ...'`, mas o `index.ts` grava o holerite como `CALCULATED` e marca o período como `CALCULATED`.
**Correção (index.ts, logo após `engine.run()`):**
```ts
if (result.status.startsWith('ERRO_CALCULO')) {
  errors.push({ contract_id: contract.id, error: result.status });
  continue;                       // não grava holerite zerado
}
...
// no final:
if (errors.length > 0) {
  return new Response(JSON.stringify({ success: false, processed: results.length, errors, results }),
    { headers: {...corsHeaders, 'Content-Type':'application/json'}, status: 422 });
}
await supabase.from('payroll_periods').update({ status: 'CALCULATED', processing_date: ... }).eq('id', period_id);
```
No `catch` do motor incluir `rubric.code` e `rubric.name` na mensagem (guardar `currentRubric` no laço).
**Aceite:** rubrica com fórmula inválida → período **não** vira CALCULATED e a resposta lista o contrato com erro.

### T6. INSS/IRRF/FGTS podem não aparecer nos itens do holerite
**Arquivos:** `PayrollEngine.ts`, `index.ts`.
**Problema:** os itens só são gravados se `mem.rubric_id` for UUID de rubrica existente. Se a rubrica 901/902/903 não existir, o valor entra em `total_descontos`/líquido, mas **não em `payslip_items`**. A busca por nome (`includes('INSS')`) pode pegar rubrica errada.
**Correção:** buscar **apenas por código** (901/902/903); se faltar, lançar erro pedindo o cadastro; criar as rubricas em migration/seed. Antes de gravar, validar a invariante:
```ts
const sum = (t: string) => itemsToInsert.filter(i => i.type === t).reduce((a, i) => a + i.amount, 0);
if (Math.abs(sum('EARNING') - result.total_proventos) > 0.01 ||
    Math.abs(sum('DEDUCTION') - result.total_descontos) > 0.01)
  throw new Error(`Itens não fecham com totais no contrato ${contract.id}`);
```
Para FGTS (rubrica `BASE`, não é desconto) manter fora da soma.
**Aceite:** consulta 0.7 retorna zero linhas após recalcular.

---

## FASE 2: Segurança e integridade dos dados

### T7. Falhas silenciosas de tabela legal
**Arquivo:** `index.ts` (bloco 3.4.1).
- Se não houver `legal_versions` vigente: **erro** (hoje cai em `legalVersions[0]`, que pode estar vencida, ou em tabela 2026 embutida).
- Exigir na versão ativa: `inss_parameters` (última faixa com `base_limit`), `irrf_parameters` (última faixa aberta) e `general_legal_parameters`. Validar e lançar erro.
- Montar `periodStartDate` sem `toISOString()` (`YYYY-MM-01` por template string) para evitar deslocamento por fuso.

### T8. Função sem autenticação/autorização (CRÍTICO)
**Arquivo:** `index.ts`, `supabase/config.toml`.
**Problema:** usa `SERVICE_ROLE_KEY` (acesso total) sem verificar quem chama; qualquer requisição que chegue à função pode disparar/recalcular **qualquer** `period_id` de qualquer tenant. CORS `*`. A resposta devolve `debug` com dados de adiantamentos.
**Correção:**
```ts
const authHeader = req.headers.get('Authorization') ?? '';
const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
const { data: { user } } = await userClient.auth.getUser();
if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
// depois de carregar o period: verificar que user pertence a period.tenant_id
// e tem permissão de cálculo (tabela de perfis/RBAC, migration 00044); senão 403
```
- Confirmar que a função **não** está publicada com `--no-verify-jwt`.
- Restringir `Access-Control-Allow-Origin` ao domínio do app.
- **Remover `debug: debugLogs` da resposta** (e os `debugLogs.push` com dados de holerite).

### T9. Recálculo não atômico
**Arquivo:** `index.ts`.
**Problema:** apaga holerites/impostos e depois insere um a um; falha no meio deixa o período com holerites faltando.
**Correção:** calcular **todos** os contratos em memória primeiro; só depois persistir tudo dentro de uma transação (função Postgres `save_payroll_period(period_id uuid, payload jsonb)` com `delete` + `insert` no mesmo bloco, chamada via `supabase.rpc`). Adicionar trava contra execuções concorrentes (ex.: `update payroll_periods set status='CALCULATING' where id=... and status<>'CALCULATING'` e checar linhas afetadas).

### T10. Impostos patronais errados no recálculo por contrato
**Arquivo:** `index.ts` (blocos "Limpa holerites" e 6.5).
**Problema:** com `contract_id`, os impostos da empresa não são apagados e são inseridos de novo só com o total daquele contrato (duplica ou subdimensiona).
**Correção:** ao final, recalcular os totais da empresa a partir de **todos** os `payslips` do período (`sum(base_inss)`, `sum(base_fgts)`), apagar e inserir uma linha por empresa.

### T11. Contrato com admissão em mês futuro entra na folha
**Arquivo:** `index.ts` (cálculo de `diasTrabalhados`).
**Problema:** `admDate > startOfMonth` também vale para admissão em meses seguintes; `30 − dia + 1` gera salário parcial indevido.
**Correção:** `if (admDate > endOfMonthDate) continue;` (registrar aviso). Tratar `diasTrabalhados <= 0`.

### T12. Rubricas de adiantamento criadas com colunas inexistentes
**Arquivo:** `index.ts` (inserts das rubricas 250/850).
**Problema:** o insert envia `incidencias` (objeto) e `rubric_type`; se essas colunas não existem, o insert falha e o código segue com rubrica "virtual" (id fora de `validRubricIds`), o que exclui o item do holerite.
**Correção:** criar 250/850 em migration (seed por tenant) e, no `index.ts`, apenas buscar; se faltar, erro claro.

---

## FASE 3: Regras trabalhistas

### T13. Base de incidências: `OR` em cascata impede desligar a base
**Arquivo:** `index.ts` (mapa de `incidencias`).
`gera_base_inss: r.generates_inss_base || r.generates_base_inss || r.incidence_inss || false` faz `incidence_inss = true` ligar a base mesmo com `generates_inss_base = false`. Unificar os nomes de coluna (migration + `Rubrics.tsx`), remover o fallback por `incidence_*` e usar `??` apenas entre nomes antigos/novos da **mesma** flag.

### T14. Eventos fixos e percentuais: valor manual ignora a regra
**Arquivos:** `index.ts`, `PayrollEngine.ts`.
`employee_fixed_events.value` vira `manual_value` e **sobrepõe** o cálculo (insalubridade 20% do mínimo, periculosidade 30%). Definir com o resultado da consulta 0.8: se o valor for percentual ou grau, enviar como `percentage`/`quantity` (sem `manual_value`); adicionar coluna `value_type` (`AMOUNT`|`PERCENT`). Insalubridade e periculosidade **não acumulam**: aplicar a maior (regra configurável).

### T15. Férias que atravessam o mês
**Arquivo:** `index.ts`.
- A consulta só busca férias com `start_date` dentro do mês; férias iniciadas no mês anterior e terminadas neste não reduzem `diasTrabalhados` (salário pago cheio).
- Usar `.lte('start_date', endOfMonth).gte('end_date', startOfMonth)` para a folha MONTHLY e **somar todas** as solicitações do contrato (não `find`).
- Calcular sobreposição em dias comerciais, com parse manual de `YYYY-MM-DD` (sem `new Date('YYYY-MM-DD')`, que é UTC), limitando a 30.
- Base das férias (rubrica 501): `salário/30 × dias` ignora médias de variáveis/adicionais habituais; definir regra de média com o contador.

### T16. INSS por competência entre folhas diferentes
`VACATION` e `MONTHLY` da mesma competência calculam INSS **separadamente**, cada uma com o próprio teto. Consolidar:
```ts
// base já tributada em outras folhas da mesma competência e contrato
const inssTotal = calc(baseJa + baseAtual) - calc(baseJa);   // calc = INSSCalculator com teto
```
Carregar `baseJa` de `payslips.base_inss` das folhas VACATION/THIRTEENTH... conforme regra (13º tem INSS em base própria; confirmar). Validar com contador.

### T17. Descontos fixos entram em férias, 13º e complementar
**Arquivo:** `index.ts` (filtro de `employeeDeductions`).
O filtro só exclui por `ADVANCE`/`MONTHLY`; em `VACATION`, `THIRTEENTH_*` e `COMPLEMENTARY` os descontos fixos são todos lançados. Padrão: só `MONTHLY`/`ADVANCE`; permitir outras folhas por flag (`apply_on_types`). Pensão alimentícia costuma exigir regra própria (base e incidência em 13º/férias).

### T18. Hora extra, adicional noturno e DSR
**Arquivo:** `PayrollEngine.ts`.
- Criar variável `BASE_HORA_EXTRA` = salário + adicionais habituais (insalubridade, periculosidade, noturno); usar como base padrão da hora extra (Súmula 264).
- `BASE_DSR` deve incluir adicional noturno e demais variáveis habituais (flag `integra_dsr` por rubrica). Hoje só HE e comissões.
- Adicional noturno: hora reduzida (52min30s) e prorrogação; hoje só fator 0,20.
- `DSR s/ faltas` (rubrica 212): validar cálculo (perda do DSR por falta injustificada).
- Remover fallback `percentage = 20` do DSR (T4 corrige a causa); sem calendário válido, erro.
- Fator da hora extra sem cadastro: **erro**, não 1,5 silencioso.

### T19. 13º, dependentes, FGTS e patronais
- **Dependentes:** usar `birth_date` (limite 21/24 anos, invalidez), vigência por competência, e evitar deduzir o mesmo dependente em dois declarantes. Trazer `person_id` no select dos contratos (remove o N+1 em `workers`).
- **13º:** média de horas extras/variáveis, faltas (>15 dias perdem avo), rescisão. Confirmar com o contador se o redutor 2026 e a dedução simplificada se aplicam à tributação exclusiva do 13º; hoje usam a mesma lógica mensal.
- **FGTS:** usar `general_legal_parameters.fgts_standard_aliquot`/`fgts_apprentice_aliquot`; passar `isApprentice` a partir do tipo de contrato.
- **Patronais:** `EmployerTaxesCalculator` aplica 20% + RAT + terceiros para todas as empresas; Simples Nacional/desoneração têm regras diferentes. Usar as flags `inss_patronal`, `rat`, `terceiros` das rubricas (hoje ignoradas) e o regime da empresa em `labor_config`.
- Gravar `engine_version` e as versões das tabelas usadas (hoje fixas em `'1.0.0'` e `'2026.1'`): salvar o `legal_versions.id` real.

### T20. Teste `Termination.test.ts` falhando
Investigar por que o "Saldo de Salário" resulta 1920 em vez de 3000 (suspeita: proporcionalidade por `dias_trabalhados` ou categoria `SALARY`; ver 0.2). Corrigir motor **ou** o teste, com justificativa no commit.

---

## FASE 4: Robustez do motor

### T21. Dinheiro sem `float`
Introduzir `money.ts` com política única (ex.: arredondamento HALF_UP a 2 casas em cada rubrica e em INSS/IRRF) usando centavos inteiros ou `decimal.js`. Quebra-galho imediato: `const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;` substituindo os `Math.round(x*100)/100` espalhados. Acumular totais e bases somente com valores já arredondados.
**Aceite:** teste de propriedade: `líquido = proventos − descontos` exato ao centavo em 1.000 casos aleatórios.

### T22. Detecção de regras por nome/código → campo explícito
1. Migration: `payroll_rubrics.rubric_kind text` (enum lógico: `SALARY_BASE`, `OVERTIME`, `DSR`, `DSR_NOTURNO`, `ADIC_NOTURNO`, `INSALUBRIDADE`, `PERICULOSIDADE`, `ABSENCE`, `LATE`, `OTHER`) com backfill pelas heurísticas atuais.
2. `Rubrics.tsx`: campo obrigatório para o tipo.
3. Motor: usar `rubric_kind`; manter as heurísticas antigas apenas como fallback com `console.warn`, depois remover.
4. Corrigir a precedência de `isAdicionalNoturno` (parênteses em `code === '301' || (name.includes('NOTURNO') && !isDsrNoturno)`) e exigir `type === 'EARNING'` em `isOvertime`, `isInsalubridade`, `isPericulosidade`.
5. Trocar `rubric.category === 'SALARY'` por `rubric_kind === 'SALARY_BASE'` na proporcionalidade.

### T23. DAG com dependências reais
**Arquivo:** `rubrics/DAGResolver.ts`.
- Adicionar dependências extraídas da fórmula: varrer identificadores `R\d+` e códigos que casem com `rubric.code`.
- Bases dinâmicas: rubricas cuja base é `BASE_DSR` dependem de todas as `OVERTIME`/`COMMISSION`/`ADIC_NOTURNO`; `BASE_DSR_NOTURNO` depende das `ADIC_NOTURNO`; `BASE_HORA_EXTRA` das adicionais habituais.
- `calculation_order` obrigatório (comparador com `undefined` gera `NaN`); mensagem de ciclo com código e nome.
**Aceite:** DSR com `calculation_order` menor que o da hora extra continua calculado depois dela.

### T24. Parser de fórmulas
**Arquivo:** `rubrics/RubricFormulaParser.ts`.
1. Remover a substituição textual por regex; resolver variáveis **na AST** (lookup em `variables`).
2. Tokenizer estrito: caractere desconhecido = `FormulaError`.
3. Suportar `> < >= <= == != && ||` e `.5`; normalizar vírgula decimal na entrada (`0,5` → `0.5`) ou validar no cadastro.
4. Variável inexistente: erro (permitir `0` apenas para códigos de rubrica que existem no tenant e não foram acionadas neste mês).
5. Divisão por zero e `NaN` → `FormulaError`.
6. No motor, **não** registrar variável só com o código numérico (`setVariable(rubric.code, ...)`): manter apenas `R{code}`; e registrar `0` também quando o valor for zero.

### T25. Outros ajustes
- `getVariable` deve lançar erro para nome inexistente (hoje devolve 0 e mascara `calculation_base` digitado errado).
- `calculation_order: r.calculation_order || 100` transforma 0 em 100: usar `??`.
- Eventos: `manual_value` zero ou negativo (estornos/ajustes) precisam ser suportados; `valorCalculado > 0` descarta proventos/descontos negativos; decidir política.
- Líquido negativo: hoje só alerta; definir política (limitar descontos ou bloquear fechamento).
- Performance: carregar deduções, eventos fixos, benefícios e dependentes **filtrados pelos contratos do período** (hoje trazem o tenant inteiro); trazer `person_id` junto do contrato. Considerar limite de tempo da Edge Function.
- Atualizar `deno.land/std@0.168.0` e `supabase-js@2.38.0` quando possível.

---

## FASE 5: Testes e validação

1. **Integração motor + calculadoras** (o que faltava): tabela do T1, INSS nos limites (1.621,00 / 2.902,84 / 4.354,27 / 8.475,55 / acima do teto), IRRF em 2.428,80 / 5.000,00 / 5.000,01 / 7.350,00 / 7.350,01, com 0, 1 e 3 dependentes (simplificada vs legal).
2. **DSR:** meses com 4 e 5 domingos, feriado em dia útil, feriado em domingo, faltas.
3. **Proporcionalidade:** admissão dia 1, 15, 31; fevereiro; férias no início, meio e fim do mês, atravessando meses.
4. **Rubricas:** duas folhas seguidas com a mesma lista (T2); ordem de `calculation_order` trocada (T23); fórmulas com vírgula decimal e comparadores (T24).
5. **Invariantes:** itens = totais (T6); bases ≥ 0; rodar duas vezes gera o mesmo resultado.
6. **Regressão de cadastro:** teste que falha se faltar rubrica 901/902/903, faixa aberta ou parâmetro legal.
7. **Golden files:** 15 a 30 holerites reais conferidos por contador; qualquer divergência vira teste permanente.

## Checklist final
- [ ] Fase 0 rodada e cadastros corrigidos
- [ ] T1 a T6 concluídas e validadas com contador
- [ ] T7 a T12 (segurança e integridade) em produção
- [ ] T13 a T20 (regras) revisadas com contador
- [ ] T21 a T25 (robustez) concluídas
- [ ] Suíte da Fase 5 verde e golden files aprovados
- [ ] Competência de teste recalculada e comparada com folha manual
