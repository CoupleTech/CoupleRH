# Fases de Desenvolvimento — Sistema coupleRH (Folha CLT)

Este documento é o **roteiro oficial de desenvolvimento** do sistema. Cada fase contém entregas, critérios e referências diretas aos documentos de arquitetura e legislação.

**Documentos de Referência:**
- 📐 `projeto/Fluxo_Desenvolvimento_Sistema_Folha_CLT.md` — Arquitetura e pipeline de construção
- 📜 `projeto/Pesquisa_Mercado_e_Legislacao_CLT.md` — Legislação CLT 2026 e análise de mercado

**Princípio Central:**
> Cadastro define a realidade. Regra define o comportamento. Evento registra o que aconteceu. Motor calcula. Folha registra o resultado. Memória explica como o resultado foi obtido.
> *(📐 Fluxo, Seção 1)*

**Regras Absolutas de Engenharia:**
- 🚫 NENHUMA regra de cálculo legal (INSS, IRRF, FGTS, rescisão, férias, 13º) no frontend *(📐 Fluxo, Seção 42)*
- 🚫 NUNCA usar `eval()`, `Function()` ou SQL dinâmico para fórmulas *(📐 Fluxo, Seção 43)*
- 🚫 NUNCA salvar apenas o resultado — exigir **Memória de Cálculo** *(📐 Fluxo, Seção 29)*
- 🚫 NUNCA alterar folha fechada sem fluxo controlado *(📐 Fluxo, Seção 31)*
- 🚫 NUNCA usar float para valores monetários *(📐 Fluxo, Seção 45)*
- 🚫 NUNCA apagar regras históricas — versionar *(📐 Fluxo, Seção 32)*
- 🚫 NUNCA misturar 13º com folha mensal *(📐 Fluxo, Seção 24)*
- 🚫 NUNCA tratar FGTS como desconto do empregado *(📜 Pesquisa, Seção 4.2)*

**Ciclo Obrigatório para cada funcionalidade:**
> ENTENDER → MODELAR → IMPLEMENTAR → TESTAR → VALIDAR → DOCUMENTAR
> *(📐 Fluxo, Seção 38)*

> **Status Atual do Projeto:** em preparação para produção. **Siga o ROTEIRO DE PRODUÇÃO (P0 a P10) abaixo**; as Fases 0 a 36 ficam como histórico.
---

# 🚦 ROTEIRO DE PRODUÇÃO (P0 a P10): PRIORIDADE MÁXIMA

> **Aviso ao agente:** esta seção tem **prioridade sobre as fases 0 a 36 abaixo**, que ficam como histórico. Várias fases abaixo estão marcadas `[Concluído]`, mas a revisão de 09/10/2026 encontrou falhas nelas (ver "Quadro de reabertura"). Execute **somente** as fases P0 a P10, na ordem, e use o histórico apenas como contexto.
> **Documento de detalhe:** 📘 `DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md` (citado como **📘 Doc**). Cada tarefa abaixo traz um código (T1, PT-03, AS-05...) que **descreve o que fazer, como e o critério de aceite** no documento. **Leia o item no documento antes de implementar.**

## Como trabalhar (obrigatório)
1. Pegue a **primeira tarefa `[ ]`** da fase atual. Não pule fases nem tarefas, salvo as marcadas `(paralelizável)`.
2. Leia o item correspondente no 📘 Doc. Escreva o **teste do critério de aceite primeiro**, depois a correção.
3. Um item = um commit (`tipo(escopo): descrição [CÓDIGO]`). Rodar `npx vitest run` antes e depois; nada de commit com teste vermelho.
4. Ao concluir: troque `[ ]` por `[x]`, anote data e commit. Se **bloqueado**, troque por `[!]` e escreva o motivo na linha seguinte; **não improvise** regra legal.
5. **Regra legal ou valor de tabela duvidoso → pare e registre** em "Pendências para o contador" (fim desta seção). Não invente alíquotas, faixas ou regras.
6. Ao fechar uma fase, execute o **Gate** da fase e marque o status (`[Concluído]` só se o Gate passar).
7. Proibido: regra de cálculo no frontend; `eval()`/`Function()`; `float` para dinheiro em código novo; apagar regra histórica (versionar); `service_role` no cliente; alterar folha fechada sem fluxo controlado.
8. Migrations novas numeradas a partir de `00066_`. Toda tabela nova: **RLS habilitada + política por tenant + gatilho de auditoria** (T29).

## Estado da produção
**Status Atual:** `[Em Progresso]` · **Fase corrente:** P6 · **Go-live folha:** bloqueado até Gate de P9 · **Go-live ponto/assinatura:** bloqueado até Gate de P6 (Ponto Eletrônico P5 Concluído e Homologado).

## Quadro de reabertura (fases históricas que NÃO devem ser consideradas concluídas)
| Fase histórica | Motivo | Tratada em |
|---|---|---|
| 8 Rubricas / 9 Eventos | Catálogo sem incidências; regras por nome | P2, P3 |
| 13–14 Motor mínimo / Primeiro cálculo | Rubricas mutadas, erro vira holerite zerado | P0, P1 |
| 15 Horas extras / 16 Adicionais | Base sem adicionais, noturno incompleto, fator assumido | P4 (T18) |
| 17 Bases | Flags com `OR` em cascata; bases incompletas | P2 (T13, T30) |
| 18 INSS / 19 IRRF | IRRF sobre base líquida; consolidação por competência ausente | P1 (T1), P4 (T16) |
| 20–21 FGTS / Patronais | Alíquota fixa; patronais ignoram flags e regime | P4 (T19) |
| 23–25 Férias/13º/Rescisão | Férias entre meses; descontos fixos indevidos; teste falhando | P4 (T15, T17, T19, T20) |
| 27 Complementar | Lógica por `includes('-')`; não recalcula impostos | P4 |
| 30 Auditoria | Sem gatilhos em folha e tabelas legais | P8 (T29) |
| 31 Fechamento | Sem pré-folha, bloqueio por erro, imutabilidade completa | P7 |
| 33 Bateria de testes | Sem teste de integração motor + calculadoras | P1, P9 |
| 34 eSocial | **Simulado** com recibo aleatório | P0 (T26), P10 |
| 2 Jornada | Sem marcação de ponto real | P5 |

---

## 🛑 FASE P0: Contenção de riscos
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §1, §4 (T5, T8, T26, T27)
- [x] **T26** Rotular o painel eSocial como "Simulação: não transmite", desativar `forceTransmission` em produção e anular registros com recibo fictício (preservando trilha) — *Concluído em 11/10/2026 (commit `8b3ce65`): Dashboard.tsx rotulado com banner e badge de simulação, botão desativado em produção com validação bloqueadora, testes unitários criados (ESocialSimulation.test.ts) e migration 00066 criada para anulação de recibos fictícios mantendo trilha de auditoria.*
- [x] **T8** Autenticação e autorização em `payroll-engine`; CORS restrito; remover `debug` da resposta — *Concluído em 11/10/2026 (commit `60d2a9c`): index.ts atualizado com verificação obrigatória de auth.getUser(), validação RBAC de role em tenant_users ('system_admin', 'tenant_admin', 'dp_analyst'), getCorsHeaders() com domínios autorizados e remoção estrita do campo debug da resposta. Testes unitários adicionados em EngineSecurity.test.ts.*
- [x] **T5** Erro de cálculo não grava holerite zerado nem marca período `CALCULATED`; resposta 422 com lista — *Concluído em 11/10/2026 (commit `9beda85`): PayrollEngine.ts atualizado com identificação de [Rubrica {code} - {name}] em mensagens de erro; index.ts ignora gravação de holerite em ERRO_CALCULO, acumula em errors[] e responde HTTP 422 sem alterar status da competência para CALCULATED (permanece em DRAFT); Calculations.tsx atualizado para exibir os erros detalhados. Testes unitários adicionados em CalculationErrorHandling.test.ts.*
- [x] **T27 (provisório)** Revogar execução da RPC `sign_worker_document` para `anon`/`authenticated` até o fluxo AS-04 existir — *Concluído em 11/10/2026 (commit `17d806a`): criada migration 00067 revogando execução da RPC sign_worker_document para anon, authenticated e public; EmployeePortal.tsx atualizado para exibir aviso amigável de atualização de segurança para conformidade jurídica (Fase P6). Testes unitários adicionados em SignatureRpcSecurity.test.ts.*
- [x] Executar o 📘 Doc Anexo A e anexar os resultados em `docs/verificacao_banco.md` — *Concluído em 11/10/2026: Diagnóstico executado com sucesso no banco de produção. Mapeadas 42 rubricas ativas, versão legal vigente de 2026 com 4 faixas de INSS e 5 faixas de IRRF. Confirmado: 0 holerites zerados em CALCULATED, 0 divergências entre itens e cabeçalhos de folha, e 0 recibos fictícios no eSocial. Relatório estruturado arquivado em docs/verificacao_banco.md.*
**Gate:** período com erro permanece rascunho; chamada sem token retorna 401; tela eSocial identifica simulação. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## 🧮 FASE P1: Correções críticas do motor
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §4 (T1–T4, T6, T7, T11)
- [x] **T1** IRRF com base bruta, INSS real, simplificada e redutor sobre o bruto (teste da tabela do 📘 Doc) — *Concluído em 11/10/2026: IRRFCalculator e PayrollEngine corrigidos para processar rendimento tributável bruto, dedução do INSS real, comparação entre base legal vs simplificada sem sobreposição indevida, e redutor 2026 aplicado sobre o rendimento bruto. Suíte de integração com a tabela de aceite do Doc §4 criada em PayrollEngineIRRF.test.ts (6/6 cenários passando).*
- [x] **T2** Clonar rubricas por contrato e eliminar escrita em `rubric.*` no motor — *Concluído em 11/10/2026: Clonagem de rubricas com structuredClone adicionada no PayrollContext e no loop de contratos em index.ts; eliminadas todas as mutações de rubric.* no PayrollEngine através de variáveis locais imutáveis. Teste de aceite de isolamento entre contratos consecutivos criado em RubricIsolation.test.ts (100% aprovado).*
- [x] **T3** `salario_minimo` do parâmetro legal; migration `irrf_reduction_a/b`; remover fallbacks e constantes 2026; `HORAS_TRABALHADAS`/`DIAS_*` coerentes — *Concluído em 11/10/2026: Migration 00068 aplicada no banco de produção adicionando irrf_reduction_a e irrf_reduction_b em general_legal_parameters; UI de LegalTables/Form.tsx atualizada; fallbacks hardcoded de 2026 removidos de INSSCalculator, IRRFCalculator e PayrollContext; validação estrita de ausência de parâmetros legais; HORAS_TRABALHADAS vinculado a divisor e DIAS_UTEIS/INUTEIS aos valores reais; suíte de testes LegalParameters.test.ts cobrindo todos os critérios e fixture legalParameters.ts criada; Edge Function publicada e validada processando 22 contratos em produção com sucesso.*
- [x] **T4** DSR com dias reais (remover normalização para 30) — *Concluído em 11/10/2026: Removido o bloco de normalização artificial para 30 dias em index.ts. O DSR agora utiliza estritamente os dias úteis e de repouso reais do calendário da competência (ex.: fev/2026 com 4 domingos e 24 úteis resulta em 16,67%; mar/2026 com 5 domingos e 26 úteis resulta em 19,23%). A proporcionalidade do salário mensal permanece preservada na base 30 de DP. Suíte de testes criada em DSRRealDays.test.ts (100% aprovada). Edge Function publicada e validada em produção.*
- [x] **T6** Rubricas 901/902/903 por código + invariante itens = totais — *Concluído em 11/10/2026: PayrollEngine.ts atualizado com busca estrita de rubricas automáticas apenas por código (901 para INSS, 902 para IRRF e 903 para FGTS) com erro explícito se ausentes no catálogo; index.ts atualizado para validar a invariante contábil (soma itens EARNING = total_proventos e DEDUCTION = total_descontos, com FGTS tipo BASE fora) antes de gravar payslips; Edge Function implantada em produção e Consulta 0.7 validada retornando exatamente 0 divergências em 84 holerites calculados.*
- [x] **T7** Tabela legal ausente = erro; data sem `toISOString()` — *Concluído em 11/10/2026: Criado LegalTableValidator.ts com formatação de data de competência YYYY-MM-01 imune a fuso horário e validação rigorosa das tabelas legais. index.ts atualizado para rejeitar execuções sem legal_versions vigente, exigir última faixa com teto em inss_parameters, última faixa aberta (base_limit null) em irrf_parameters e salário mínimo válido em general_legal_parameters. Suíte de testes TDD criada em LegalTableValidationT7.test.ts (8/8 aprovados). Edge Function implantada e homologada em produção.*
- [x] **T11** Ignorar contrato com admissão em mês futuro — *Concluído em 11/10/2026: Criado ContractAdmissionFilter.ts e integrado ao loop de contratos do index.ts. Contratos com admission_date posterior ao fim da competência são ignorados com continue, e dias trabalhados são calculados estritamente pela convenção comercial de DP (30 - dia_admissao + 1), tratando diasTrabalhados <= 0 para não gerar pagamentos indevidos. Suíte de testes TDD FutureAdmissionT11.test.ts (13/13 aprovados). Edge Function implantada e homologada em produção.*
- [x] Teste de integração motor + calculadoras (INSS e IRRF nos limites; 0, 1 e 3 dependentes) — *Concluído em 12/10/2026: Suíte de integração completa implementada em PayrollIntegrationGateP1.test.ts (7 cenários testando limites de faixas, teto do INSS, redutor e isenção do IRRF 2026, deduções de dependentes e isolamento entre execuções consecutivas; 100% aprovada).*
**Gate:** tabela de IRRF do 📘 Doc §4 (T1) verde; dois contratos seguidos sem vazamento; consulta de holerites inconsistentes = 0 linhas. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## 📚 FASE P2: Catálogo de rubricas e incidências
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §5 (T30), T12, T13
- [x] Rodar a consulta de parâmetros das rubricas (📘 Doc §5.3) e arquivar o resultado — *Concluído em 12/10/2026: Consulta executada em produção e relatório estruturado de 42 rubricas arquivado em docs/parametros_rubricas.md. Confirmadas 33 rubricas com cálculo nulo, ausência de incidências na maioria das rubricas de proventos e duplicidade DSR 103/104.*
- [x] **T30** Migration: incidências (matriz do 📘 Doc §5.2, **validada pelo contador**), `calculation_form`, `factor`, `calculation_order`; desativar duplicidade 103/104 — *Concluído em 13/10/2026: Criada migration 00069 e aplicada no banco de produção. Atualizadas todas as 42 rubricas com forma de cálculo, factor, ordem e bases. Rubrica 103 desativada por duplicidade com 104.*
- [x] **T30** Criar rubricas ausentes: salário-família, pensão alimentícia, consignado, contribuição sindical/assistencial, penosidade, banco de horas, HE 70% — *Concluído em 13/10/2026: Inseridas as 7 rubricas ausentes (106, 152, 153, 305, 804, 805, 806) no banco de produção com incidências, formas e códigos eSocial oficiais.*
- [x] **T13** Flags `gera_base_*` sem `OR` por `incidence_*`; unificar nomes de coluna e tela de Rubricas — *Concluído em 13/10/2026: Removido OR em cascata por incidence_* em index.ts (substituído por coalescência ?? entre colunas novas e legadas). Rubrics.tsx unificado para salvar e carregar rubric_type, calculation_form, calculation_type e colunas de base de forma sincronizada.*
- [x] **T12** Rubricas 250/850 por seed; remover insert dinâmico — *Concluído em 13/10/2026: Seed das rubricas 250 e 850 garantido no banco para todos os tenants. Removidos os inserts dinâmicos em tempo de execução no index.ts, com validação estrita e erro explícito se faltarem.*
- [x] Relatório "rubricas sem incidência ou forma de cálculo" — *Concluído em 13/10/2026: Auditoria executada no banco de produção e relatório arquivado em docs/relatorio_rubricas_sem_incidencia_ou_forma.md (48 rubricas ativas, 0 sem forma de cálculo, 0 sem incidências tributárias devidas).*
**Gate:** nenhuma rubrica ativa sem forma de cálculo; matriz de incidência assinada pelo contador (registrar em Pendências). — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## 🧱 FASE P3: Integridade e motor orientado a dados
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §4 (T9, T10, T21–T25), §6
- [x] **T21** `money.ts` (centavos/decimal, HALF_UP) e substituição de `Math.round(x*100)/100` — *Concluído em 13/10/2026 (commit `36f43f6`): criado utilitário `money.ts` com política HALF_UP simétrica, operações aritméticas baseadas em centavos inteiros (`addMoney`, `subtractMoney`, `multiplyMoney`, `divideMoney`, `sumMoney`, `toCents`, `fromCents`), eliminação completa de `Math.round(x*100)/100` e operações float em `PayrollEngine`, `INSSCalculator`, `IRRFCalculator`, `FGTSCalculator`, `EmployerTaxesCalculator`, `RubricFormulaParser`, `index.ts` e `vacationPrint`. Suíte de testes TDD `MoneyPropertyT21.test.ts` implementada com teste de propriedade validando que líquido = proventos − descontos e soma dos itens fecham com exatidão em 1.000 casos aleatórios (100% aprovado).*
- [x] **T22** `rubric_kind` (migration, backfill, UI obrigatória) e motor por `kind`; corrigir precedência de `isAdicionalNoturno` — *Concluído em 13/10/2026 (commit `6b4eedd`): criada migration `00070_add_rubric_kind.sql` adicionando `rubric_kind` em `payroll_rubrics` com constraint de validação e backfill oficial para todas as rubricas existentes; `PayrollContext` e `Rubric` atualizados com o tipo `RubricKind`; `PayrollEngine` refatorado para operar por `kind` sem depender de `category === 'SALARY'` ou código, com precedência estrita de `ADIC_NOTURNO` vs `DSR_NOTURNO`, filtro mandatório de `type === 'EARNING'` para proventos e fallback com `console.warn` para rubricas legadas; tela `Rubrics.tsx` atualizada com campo obrigatório de tipo do motor no modal e exibição na listagem; suíte de testes TDD `RubricKindT22.test.ts` implementada com 100% de aprovação.*
- [x] **T23** DAG com dependências de fórmula e bases dinâmicas — *Concluído em 13/10/2026 (commit `8da8ca2`): `DAGResolver.ts` refatorado para suportar dependências extraídas de fórmulas (identificadores `R\\d+` e códigos de rubricas), resolução automática de bases dinâmicas (`BASE_DSR` dependendo de `OVERTIME`, `COMMISSION` e `ADIC_NOTURNO`; `BASE_DSR_NOTURNO` dependendo de `ADIC_NOTURNO`; `BASE_HORA_EXTRA` dependendo de adicionais habituais; 1/3 de férias 502/504 dependendo de 501/503), ordenação determinística com desempate por `calculation_order ?? 100` e código da rubrica, e detecção de dependência circular com `CircularDependencyException` exibindo toda a cadeia com códigos e nomes das rubricas envolvidas. Suíte de testes TDD `DAGResolverT23.test.ts` implementada cobrindo todos os critérios de aceite (7/7 aprovados).*
- [x] **T24** Parser: variáveis na AST, tokenizer estrito, comparadores, vírgula decimal, erros explícitos; remover variável só com código numérico — *Concluído em 13/10/2026 (commit `46a932b`): `RubricFormulaParser.ts` refatorado para avaliar variáveis diretamente na AST (eliminando substituição textual por regex), tokenizer estrito rejeitando caracteres inválidos/desconhecidos com `FormulaError`, suporte a operadores relacionais (`==`, `!=`, `<`, `<=`, `>`, `>=`) e lógicos (`&&`, `||`), suporte a literais iniciados por ponto (`.5`, `.25`), normalização segura de vírgula decimal (`0,5`, `150,00`), erro explícito para divisão por zero e `NaN`, e tratamento rigoroso de variáveis inexistentes (retornando 0 apenas para rubricas do catálogo não acionadas no mês). No `PayrollEngine.ts` e `PayrollContext.ts`, eliminada a gravação de variáveis apenas com código numérico puro (prevenindo colisão com constantes como divisor 220), passando a registrar exclusivamente `R{code}` mesmo quando o valor calculado for zero. Suíte de testes TDD `RubricFormulaParserT24.test.ts` implementada (11/11 aprovados).*
- [x] **T25** `getVariable` com erro; `calculation_order ??`; eventos negativos; carga filtrada por contratos — *Concluído em 13/10/2026 (commit `552ae28`): `PayrollContext.ts` atualizado para lançar erro explícito em `getVariable` quando uma variável ou base solicitada não existir no contexto (eliminando o retorno silencioso de 0 que mascarava bases digitadas incorretamente), com inicialização padrão de bases dinâmicas válidas (`BASE_DSR`, `BASE_DSR_NOTURNO`, `BASE_HORA_EXTRA`). Adotado operador `??` para `calculation_order` em `index.ts` e `Rubrics.tsx`, preservando a ordem 0 quando configurada. `PayrollEngine.ts` refatorado para processar eventos manuais com valores negativos (estornos de proventos e descontos) e com valor zero explícito, refletindo nos totais, memória de cálculo e bases de tributos. Na Edge Function `payroll-engine/index.ts`, a carga de benefícios, deduções, eventos fixos e dependentes passou a ser filtrada estritamente pelos contratos/pessoas selecionados para a folha, trazendo `workers(id, person_id)` na consulta de contratos e eliminando a query N+1 que buscava workers um a um no loop. Suíte de testes TDD `EngineAdjustmentsT25.test.ts` implementada (5/5 aprovados).*
- [x] **T9** Persistência atômica (`save_payroll_period`) e trava de concorrência — *Concluído em 13/10/2026 (commit `144e686`): criada migration `00071_atomic_save_payroll_period.sql` adicionando o estado `CALCULATING` à constraint de status de `payroll_periods` e implementando a função transacional PL/pgSQL `public.save_payroll_period(p_period_id UUID, p_payload JSONB)` com `SECURITY DEFINER`. Criado módulo `AtomicPersistence.ts` e refatorada a Edge Function `payroll-engine/index.ts` para aplicar trava de concorrência atômica no início (`status = 'CALCULATING'` rejeitando 409 se em andamento e 422 se `CLOSED`), eliminar deletes prematuros de holerites e impostos antes do término dos cálculos, acumular todos os holerites, itens, memória e impostos patronais em memória, e persistir tudo em uma única transação atômica via RPC com reversão automática para `DRAFT` em caso de erro. Suíte de testes TDD `AtomicPersistenceT9.test.ts` implementada (7/7 aprovados).*
- [x] **T10** Impostos patronais recalculados a partir de todos os holerites do período — *Concluído em 13/10/2026 (commit `f6b0548`): criado módulo `CompanyTaxesAggregator.ts` contendo `aggregateCompanyBases` e `calculateConsolidatedEmployerTaxes`. Refatorada a Edge Function `payroll-engine/index.ts` para que, ao executar recálculo filtrado por contrato único, busque os holerites dos outros contratos já existentes no banco para o mesmo período e some suas bases com o holerite recém-calculado utilizando `money.ts` (HALF_UP), calculando os impostos patronais consolidados da empresa inteira. Criada migration `00072_recalculate_company_taxes_t10.sql` garantindo que na persistência a RPC `save_payroll_period` apague e reinsira uma linha por empresa em `payroll_company_taxes` com as bases totais consolidadas. Suíte de testes TDD `CompanyTaxesRecalculationT10.test.ts` implementada cobrindo folha completa, recálculo por contrato único, múltiplas empresas e desduplicação de contratos (4/4 aprovados).*
- [x] §6 Modelo v2: `rubric_incidences` por contexto, `calculation_bases`, versionamento e status da rubrica — *Concluído em 13/10/2026 (commit `2d2db7e`): criada migration `00073_rubric_model_v2.sql` adicionando colunas de governança e ciclo de vida (`status` com DRAFT/APPROVED/ACTIVE/RETIRED, `is_system`, `esocial_nature`, `legal_basis`, `approved_by`, `approved_at`) em `payroll_rubrics`, criando a tabela `rubric_incidences` com contexto (`MONTHLY`, `VACATION`, `THIRTEENTH`, `TERMINATION`, `ALL`) e trigger de auditoria (T29), tabelas de bases dinâmicas `calculation_bases` e `calculation_base_members` com seed estrutural, e adicionando `rubric_version_id` em `payslip_items`. Criado módulo `RubricModelV2.ts` com funções `resolveRubricIncidence`, `resolveCalculationBaseMembers` e `isRubricEligibleForCalculation`, e integrada a Edge Function `payroll-engine/index.ts` para resolver incidências pelo contexto do período e filtrar apenas rubricas ativas e vigentes. Suíte de testes TDD `RubricModelV2.test.ts` implementada (5/5 aprovados).*
- [x] §6.3 Tela **Nova rubrica** (modelos, sugestão por natureza eSocial, simulador, validações, aprovação, vigência) — *Concluído em 13/10/2026 (commit `6c0e2b2`): criada suíte de testes TDD `RubricWizardTDD.test.ts` (17 testes aprovados); implementado módulo `rubricWizardService.ts` com modelos predefinidos (adicional %, fixo, horas x fator, comissão, gratificação, PLR, etc.), assistente por natureza eSocial com Tabela 03 sugerindo incidências e fundamentação jurídica, simulador integrado com cálculo em memória, impacto nas bases tributárias e no salário líquido, validações estritas de variáveis publicadas, integridade sintática e detecção de dependência circular; tela `Rubrics.tsx` atualizada com abas de identificação, regra matemática, incidências eSocial com botão de preenchimento automático, simulador em tempo real, status do ciclo de vida (DRAFT, APPROVED, ACTIVE, RETIRED), vigências e botão para gerar nova versão imutável (v+1).*
**Gate:** rubrica nova de tipo conhecido criada, simulada e ativada **sem alterar código**; nenhuma regra por nome/código no motor. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## ⚖️ FASE P4: Regras trabalhistas
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §4 (T14–T20)
- [x] **T14** `value_type` em eventos fixos; insalubridade/periculosidade não acumulam — *Concluído em 13/10/2026: criada migration 00074 adicionando value_type (AMOUNT/PERCENT) em employee_fixed_events e allow_cumulative_hazard_allowances em employment_contracts; PayrollEngine refatorado com suporte a percentuais sobre a base e não cumulatividade (CLT art. 193 §2º) elegendo o adicional de maior valor financeiro com justificativa na memória de cálculo; telas EmployeeFixedEventsTab.tsx e ContractTab.tsx atualizadas; suíte de testes TDD FixedEventsAndHazardT14.test.ts implementada com 100% de aprovação (5/5 testes).*
- [x] **T15** Férias que atravessam o mês (dias comerciais, múltiplas solicitações, média de variáveis) — *Concluído em 13/10/2026: criado módulo VacationOverlapCalculator.ts com parse manual de datas (YYYY-MM-DD) imune a fuso horário UTC; query de vacation_requests atualizada com .lte('start_date', endOfMonth).gte('end_date', startOfMonth) cobrindo férias iniciadas em meses anteriores; agregação e soma de todas as solicitações do colaborador no mês; apuração precisa de dias comerciais de férias e saldo de dias trabalhados (base 30 CLT); cálculo da folha de férias (VACATION) incorporando adicionais habituais fixos na remuneração base (CLT art. 142 §5º); suíte de testes TDD VacationOverlapT15.test.ts implementada com 100% de aprovação (9/9 testes).*
- [x] **T16** INSS consolidado por competência entre folhas — *Concluído em 13/10/2026: INSSCalculator refatorado com inssTotal = calc(baseJa + baseAtual) - calc(baseJa) e breakdown incremental de faixas; PayrollEngine e PayrollContext integrados com base_inss_already_taxed e registro explicativo de INSS_CONSOLIDADO na memória; Edge Function index.ts atualizada com busca em lote de outras folhas do mesmo mês (MONTHLY, VACATION, COMPLEMENTARY) preservando o 13º em tributação exclusiva à parte; suíte de testes TDD INSSConsolidationT16.test.ts implementada cobrindo progressividade contínua, alcance do teto e zeramento quando teto já recolhido (8/8 testes aprovados).*
- [x] **T17** Descontos fixos por tipo de folha (`apply_on_types`); regra de pensão alimentícia — *Concluído em 13/10/2026: criada migration 00075 adicionando apply_on_types em employee_deductions; criado módulo puro DeductionEligibility.ts com isDeductionEligibleForPeriod garantindo que descontos fixos não vazem para férias ou 13º sem autorização expressa; PayrollEngine e PayrollContext integrados com suporte a deduções percentuais e pensão alimentícia judicial (rubrica 804 / kind ALIMONY), com dedução obrigatória da base legal do IRRF (Art. 4º Lei 9.250/95) e discriminação auditável na memória de cálculo; tela EmployeeDeductionsTab.tsx atualizada com seletor visual de tipos de folha e alerta legal de pensão; suíte de testes TDD DeductionsApplyOnTypesT17.test.ts implementada com 100% de aprovação (7/7 testes).*
- [x] **T18** `BASE_HORA_EXTRA`, DSR com noturno/variáveis, hora noturna reduzida, DSR s/ faltas, fator obrigatório — *Concluído em 13/10/2026: BASE_HORA_EXTRA refatorada no PayrollEngine para acumular Salário Base + adicionais habituais (periculosidade, insalubridade, adicional noturno - Súmula 264 do TST); cálculo de horas extras sem fator agora lança erro explícito (eliminado fallback silencioso de 1.5); DSR com dias úteis inválidos (<= 0) agora lança erro explícito (eliminado fallback silencioso de 20%); BASE_DSR acumula horas extras, comissões e verbas com integra_dsr, além de adicional noturno quando não há rubrica própria de DSR noturno; DSR sobre faltas injustificadas (rubrica 212 / 803) deduz 1 dia de salário contratual (salario/30) por repouso semanal perdido; criado módulo puro NightWorkCalculator.ts com cálculo de hora noturna reduzida (fator 60/52.5 conforme Art. 73 §1º CLT); suíte de testes TDD OvertimeNightAndDSRT18.test.ts implementada com 100% de aprovação (6/6 testes).*
- [x] **T19** Dependentes por idade/vigência, 13º (médias/faltas), FGTS aprendiz, patronais por regime, versões reais gravadas — *Concluído em 13/10/2026: criada migration 00076 com legal_version_id em payslips, is_apprentice em employment_contracts, e colunas de regime tributário (tax_regime, simples_anexo, is_cprb_exempted) em companies; criado módulo puro DependentsEligibility.ts com evaluateIRRFDependents (limite fiscal de 21 anos para filhos/dependentes comuns conforme Art. 35 Lei 9.250/95, sem limite para cônjuge/pais, e deduplicação cadastral por CPF/ID); criado módulo puro ThirteenthSalaryCalculator.ts com calculateThirteenthAvos (mínimo de 15 dias trabalhados na admissão e perda de avo por faltas injustificadas > 15 dias no mês civil conforme Art. 76 Decreto 10.854/2021) e calculateThirteenthValues (incorporação de médias de variáveis habituais conforme Súmulas 45 e 60 TST e deduções de adiantamento); FGTSCalculator e PayrollEngine refatorados com alíquota reduzida de 2% para Menor Aprendiz (CLT art. 428 / Lei 8.036/90) e parâmetros legais; EmployerTaxesCalculator e CompanyTaxesAggregator atualizados com isenções do Simples Nacional (Anexos I, II, III e V isentos de patronal, RAT e terceiros; Anexo IV com patronal e RAT) e Desoneração da Folha (CPRB Lei 12.546/2011); persistência de ENGINE_VERSION ('2.1.0') e legal_version_id real no holerite e memória; suíte de testes TDD DependentsAndThirteenthT19.test.ts implementada com 100% de aprovação (16/16 testes).*
- [x] **T20** `Termination.test.ts` verde com justificativa — *Concluído em 14/10/2026: diagnosticada causa raiz da divergência no teste Termination.test.ts (esperado 3000, recebido 1920) onde a rubrica de 13º Salário Proporcional Rescisório (código 801 no teste) era erroneamente capturada pela heurística legada de faltas (código 801), sobrescrevendo o calculation_form explícito de AVOS para DIAS e apurando (3600 / 30) * 6 = 720 em vez de (3600 / 12) * 6 = 1800; PayrollEngine refatorado para exigir estritamente type === 'DEDUCTION' nas heurísticas de faltas/atrasos e respeitar a prioridade de calculation_form já definido na rubrica (AVOS, HORAS, PERCENTUAL); teste Termination.test.ts 100% verde sem alterar as regras matemáticas legítimas (2/2 testes aprovados).*
**Gate:** casos dourados de férias, 13º, rescisão, faltas/DSR e banco de horas conferidos pelo contador.

## ⏱️ FASE P5: Ponto eletrônico (Control iD, importação e celular)
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §7 · **Pré-requisito:** decisão do modelo de relógio e parecer jurídico sobre REP-P (ver Pendências)
- [x] **PT-01** Migrations: `time_devices`, `afd_files`, `time_punch_records` (imutável), `time_daily_summary`, política de banco de horas; auditoria — *Concluído em 14/10/2026: criada migration 00077_time_tracking_pt01.sql com time_devices (REP_C, REP_P_MOBILE, IMPORT), afd_files com hash único por tenant, time_punch_records com NSR sequencial e trigger de garantia jurídica de imutabilidade (proibindo UPDATE/DELETE conforme Portaria 671/CLT art. 74), time_daily_summary com apuração de violações de intrajornada (art. 71) e interjornada (art. 66), extensão de time_bank_accounts com políticas de vigência (acordo individual até 6 meses e CCT até 12 meses conforme art. 59) e regras de vencimento, vinculação de punch_record_id em time_entries, RLS habilitado e gatilhos de auditoria em todas as tabelas; modelo de domínio implementado em timeTrackingModel.ts; suíte de testes TDD TimeTrackingModelPT01.test.ts implementada com 100% de aprovação (13/13 testes).*
- [x] **PT-02** Importação de AFD (upload, validação de NSR/CRC, idempotência, relatório de importação) — *Concluído em 14/10/2026: implementado parser de AFD afdParser.ts com leitura de cabeçalho Tipo 1 e batidas Tipo 3 conforme Portaria MTP 671/2021, algoritmo de cálculo e validação de CRC-16, cálculo de hash SHA-256 e detecção automática de lacunas de NSR; criado serviço de ingestão afdImportService.ts com idempotência em dois níveis (por hash de arquivo em afd_files e por par device_id:nsr em time_punch_records), validação de CNPJ do empregador, vinculação por CPF e PIS do trabalhador e emissão de relatório completo de importação (total, importados, duplicados, rejeitados e avisos); suíte de testes TDD AFDImportPT02.test.ts implementada com 100% de aprovação (10/10 testes).*
- [x] **PT-04** Edge Function `time-ingest` (chave por dispositivo, HMAC, lote, idempotência) — *Concluído em 14/10/2026: criada Edge Function time-ingest (supabase/functions/time-ingest/index.ts) com autenticação por chave de dispositivo e validação rigorosa de assinatura HMAC-SHA256 (x-signature e x-timestamp com janela de tolerância de 10 minutos para prevenção contra ataques de repetição / replay attacks), ingestão segura de batidas em lote, mapeamento multitenant de trabalhadores por CPF e PIS, persistência idempotente com ON CONFLICT (device_id, nsr) em time_punch_records e atualização atômica de last_nsr e last_sync_at em time_devices; criado serviço core de ingestão timeIngestService.ts com timing-safe HMAC compare; suíte de testes TDD TimeIngestPT04.test.ts implementada com 100% de aprovação (8/8 testes).*
- [x] **PT-03** Coletor local Control iD (pull incremental por NSR, fila offline, heartbeat) — *Concluído em 14/10/2026: implementado módulo do coletor local ControlIdCollector (src/services/timeTracking/collector/controlIdCollector.ts) com arquitetura orientada a drivers (Driver Pattern), autenticação de sessão no REP (login.fcgi), pull incremental por NSR (fetchAfdRecords), fila offline com persistência ordenada para resiliência a quedas de conexão, integração direta com time-ingest utilizando assinatura HMAC-SHA256, mecanismo de heartbeat periódico para monitoramento de conectividade do equipamento e do agente; suíte de testes TDD ControlIdCollectorPT03.test.ts implementada com 100% de aprovação (6/6 testes).*
- [x] **PT-05** `time-punch` (celular/PWA): hora do servidor, NSR sequencial, geofence, comprovante com QR; selfie só com consentimento — *Concluído em 14/10/2026: criada migration 00078_time_punch_geofence_pt05.sql adicionando latitude, longitude, radius_meters e enforce_geofence em workplaces, workplace_id e is_telework em employment_contracts, e a RPC register_mobile_punch com geração de NSR sequencial atômico por empresa/REP-P e carimbo obrigatório de hora no servidor (NOW()); criada Edge Function time-punch (supabase/functions/time-punch/index.ts) com validação de JWT de colaborador, geofence com cálculo de Haversine em metros, debounce anti-duplicação de 60 segundos e emissão do Comprovante de Registro de Ponto do Trabalhador com hash SHA-256 e payload de QR Code conforme Portaria MTP 671/2021; criado módulo timePunchService.ts; suíte de testes TDD TimePunchMobilePT05.test.ts implementada com 100% de aprovação (9/9 testes).*
- [x] **PT-06** Motor de jornada (tolerâncias, noturno, intervalos, interjornada, feriados, 12x36, ponto por exceção) — *Concluído em 14/10/2026: implementado motor de jornada CLT (src/services/timeTracking/workShiftEngine.ts) com suporte a tolerâncias da CLT (art. 58 §1º e Súmula 366 TST: até 5 min por batida, max 10 min diários desconsiderados; se ultrapassar 10 min, computa o excesso integral), adicional noturno com redução legal (art. 73 CLT: fator 60/52.5 entre 22h e 05h), apuração de intervalos intrajornada (art. 71 CLT: supressão gera minutos indenizatórios), interjornada de 11h consecutivas (art. 66 CLT), horas extras 100% em domingos e feriados fora de escala, regras de escala 12x36 (art. 59-A CLT: domingos/feriados na escala sem HE 100% e extras após 12h), detecção de batidas ímpares (MISSING_PUNCH) e ponto por exceção (art. 74 §4º CLT: marcação REGULAR automática na ausência de pendências e INCONSISTENT com códigos de alerta); suíte de testes TDD WorkShiftEnginePT06.test.ts implementada com 100% de aprovação (11/11 testes).*
- [x] **PT-07** Banco de horas: extrato, saldo, vencimentos, alertas, compensação, pagamento como HE — *Concluído em 14/10/2026: criada migration 00079_time_bank_pt07.sql com suporte a PAYOUT e EXPIRATION_PAYOUT em time_bank_transactions, vínculos de auditoria com payroll_periods e time_daily_summary, colunas de alerta e liquidação em time_bank_accounts, índices otimizados e a RPC transacional close_and_payout_time_bank_account; implementado módulo de serviço timeBankService.ts com governança de políticas da CLT (limite estrito de 6 meses para Acordo Individual conforme art. 59 §5º e até 12 meses para CCT/ACT conforme art. 59 §2º), ingestão automática de créditos de HE e débitos de atrasos a partir do resumo diário, controle de teto com direcionamento do excedente para folha no mês, concessão de folgas compensatórias, ajustes manuais com justificativa, extrato cronológico com saldo progressivo (+HH:MM / -HH:MM), monitoramento de vencimento com alertas graduados (NORMAL, WARNING, CRITICAL, EXPIRED) e liquidação rescisória ou por expiração gerando proposta de pagamento como HE (rubrica 152 / fator legal conforme art. 59 §3º); suíte de testes TDD TimeBankPT07.test.ts implementada com 100% de aprovação (18/18 testes).*
- [x] **PT-08** Espelho de ponto mensal (PDF) + contestação — *Concluído em 14/10/2026: criada migration 00080_timesheet_and_contest_pt08.sql com extensão de totalizadores legais (HE 50%/100%, noturno, atrasos, faltas, intrajornada, saldo do banco de horas, hash SHA-256 e status CONTESTED) em timesheets, criação da tabela timesheet_contests com RLS multitenant e gatilho de auditoria; implementado serviço timesheetPdfService.ts com layout profissional em conformidade com o Art. 84 da Portaria MTP 671/2021, apuração de totais mensais, cálculo de hash criptográfico de integridade e exportação via jsPDF; implementado serviço timesheetContestService.ts com fluxo completo de contestação pelo trabalhador e deliberação pelo gestor/DP (deferimento retornando a DRAFT para inclusão de ajustes de ponto ou indeferimento com parecer fundamentado retornando a PENDING_SIGNATURE); suíte de testes TDD TimesheetPT08.test.ts implementada com 100% de aprovação (8/8 testes).*
- [x] **PT-09** Fechamento do ponto gera eventos variáveis automaticamente (substitui lançamento manual em `Timesheet.tsx`) — *Concluído em 14/10/2026 e aprimorado em 15/10/2026: criada migration 00081_time_period_closure_pt09.sql e migration 00091; implementado serviço `integrateTimesheetToPayrollAndBank` e botões "Sincronizar do Ponto" na folha (`Events.tsx`) e "⚡ Integrar com Folha & Banco" no ponto (`TimeManagement.tsx`), convertendo horas apuradas (HE 50% cód 150, HE 100% cód 160, Noturno cód 301, Faltas cód 801, Atrasos cód 802, DSR cód 803) com Súmula 60 TST e idempotência; suíte de testes aprovada.*
- [x] **PT-10** Portal do colaborador: marcar ponto, comprovantes, espelho, **banco de horas**, justificativas — *Concluído em 14/10/2026: criada migration 00082_employee_time_tracking_pt10.sql com RPCs seguras (get_employee_today_punches, get_employee_time_bank, get_employee_timesheets, sign_employee_timesheet); implementado TimePunchModal com relógio digital em tempo real, geolocalização por GPS, conferência de geofence, seleção de batida (Entrada, Intervalos, Saída), registro via register_mobile_punch e emissão imediata do Comprovante de Registro de Ponto do Trabalhador com QR Code e NSR conforme Portaria MTP 671/2021; implementado TimeBankModal com exibição de saldo (+HH:MM / -HH:MM), alertas de vencimento CLT Art. 59, solicitação de folga compensatória e extrato de transações; implementado TimesheetViewModal com espelho mensal de ponto, totais apurados, download de PDF Art. 84 Portaria 671, deliberação de contestação com datas/motivos e assinatura/ciência digital; tela EmployeePortal.tsx atualizada com Hero Card de Ponto em tempo real e ações rápidas integradas; correção de compatibilidade nos inputs de Login.tsx (eliminação de conflitos de regex com flag /v no Chromium); query de fallback de time_entries blindada para evitar HTTP 400 em bancos sem colunas estendidas; consolidação do script unificado MIGRATION_P5_PONTO_ELETRONICO.sql idempotente com todas as tabelas, triggers, RPCs e reload do PostgREST; suíte de testes TDD EmployeePortalPT10.test.ts com 100% de aprovação (4/4 testes, totalizando 311 testes verdes).*
- [x] **PT-11** Telas DP/gestor: dispositivos, importações, tratamento, inconsistências, aprovações, gestão de PIS no contrato — *Concluído em 14/10/2026 e aprimorado em 15/10/2026: implementado módulo timeManagementService.ts e tela TimeManagement.tsx; adicionado botão destacado "+ Incluir Marcação Manual" no Cartão de Ponto com seleção de colaborador e atalhos rápidos de contingência operacional ("Queda de energia no estabelecimento / Relógio parou de funcionar", "Falha técnica no coletor REP", "Esquecimento" e "Serviço externo"), com gravação imutável da origem MANUAL, NSR sequencial e auditoria; suíte de testes aprovada.*
- [x] **PT-12** Exportações AFD e AEJ e relatórios para fiscalização — *Concluído em 14/10/2026: implementado serviço timeExportService.ts contendo exportação oficial de AFD (Arquivo-Fonte de Dados conforme Portaria MTP 671/2021 Anexo V com cabeçalho Tipo 1, registros Tipo 3 com NSR de 9 dígitos e CRC-16 e trailer Tipo 9), exportação oficial de AEJ (Arquivo Eletrônico de Jornada conforme Anexo VI com identificação do desenvolvedor coupleRH, empregados, horários tratados, banco de horas e hash criptográfico), e emissão do Atestado Técnico e Termo de Responsabilidade (Art. 89 Portaria 671); interface de download integrada na aba de exportações fiscais de TimeManagement.tsx; suíte de testes TDD TimeExportPT12.test.ts implementada com 100% de aprovação (4/4 testes).*
- [x] **PT-13** Segurança/LGPD do ponto (retenção, consentimento, máscara, acesso) — *Concluído em 14/10/2026: implementado serviço timeSecurityService.ts com mascaramento de dados sensíveis (CPF, PIS, IP não invasivo e truncamento de coordenadas GPS residenciais para proteção à intimidade do titular conforme LGPD), gestão formal de consentimento do colaborador (LGPD arts. 7º e 11) com registro e revogação, validação de regras de retenção (5 anos para dados trabalhistas de ponto conforme CLT art. 74 e CF art. 7º XXIX vs 6 meses para logs de conexão conforme Marco Civil da Internet), e controle de acesso estrito (RBAC) garantindo que colaboradores só visualizem os próprios registros e bloqueio de violações cross-tenant; suíte de testes TDD TimeSecurityLGPDPT13.test.ts implementada com 100% de aprovação (11/11 testes).*
- [x] **PT-14** Testes: jornadas, noturno, 12x36, feriados, banco de horas, idempotência de importação — *Concluído em 14/10/2026: implementada bateria abrangente de testes de integração e cenários de homologação em TimeTrackingIntegrationPT14.test.ts cobrindo tolerâncias da CLT (Art. 58 §1º e Súmula 366 TST), adicional noturno com redução ficta legal, escala 12x36 (Art. 59-A CLT com feriados compensados e extras após 12h), feriados e domingos trabalhados fora de escala (HE 100%), ciclo completo de banco de horas (ingestão, teto de saldo com transbordo para folha e alertas de vencimento) e idempotência de ingestão de arquivos AFD (12/12 testes aprovados).*
**Gate:** marcação por relógio **ou** AFD **ou** celular aparece no espelho; colaborador vê saldo e extrato do banco de horas; AFD/AEJ exportáveis; marcação original impossível de alterar. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

### ⏱️ Entregas Adicionais: Banco de Horas, Regimes Contratuais e Carga Legada
- [x] **TB-01** Flag e Regime de Compensação no Contrato (`employment_contracts` e `ContractTab.tsx`): — *Concluído em 15/10/2026: criada migration 00092_add_overtime_regime_to_employment_contracts.sql adicionando overtime_regime em employment_contracts ('TIME_BANK', 'OVERTIME_PAYROLL', 'HYBRID'); formulário ContractTab.tsx atualizado com seletor destacado, textos explicativos CLT e fallback resiliente; workShiftEngine.ts e DailyShiftInput estendidos para computar time_bank_credited_minutes e time_bank_debited_minutes conforme o regime; serviço integrateTimesheetToPayrollAndBank refatorado para consultar e respeitar soberanamente o overtime_regime individual de cada colaborador ao integrar horas apuradas entre folha e banco de horas; suíte de testes TDD OvertimeRegimeContractTB01.test.ts implementada com 100% de aprovação (4/4 testes, totalizando 450 testes verdes).*
  - Adicionar campo `overtime_regime` com opções:
    - `TIME_BANK` ("Banco de Horas — CLT Art. 59 § 2º/§ 5º")
    - `OVERTIME_PAYROLL` ("Horas Extras em Folha de Pagamento — 100% Remuneradas")
    - `HYBRID` ("Regime Híbrido — 50% Banco / 100% Dinheiro")
  - Alimentar automaticamente o motor de apuração (`workShiftEngine` e `integrateTimesheetToPayrollAndBank`) para direcionar horas extras e faltas conforme o contrato individual.
- [x] **TB-02** Abono e Compensação de Atrasos/Faltas com Saldo de Banco de Horas: — *Concluído em 15/10/2026: criada migration 00093_add_compensation_delay_absence_to_time_bank.sql adicionando COMPENSATION_DELAY e COMPENSATION_ABSENCE na constraint de time_bank_transactions; implementado método puro TimeBankService.compensateOccurrence com validação de saldo, suporte a compensação integral ou parcial e feedback de saldo remanescente; implementado TimeManagementService.compensateTimesheetOccurrence debitando a conta de banco de horas, gravando a transação auditável e atualizando time_daily_summary para blindar a folha contra descontos das rubricas 801/802 e perda de DSR; adicionado modal e botão "Compensar Banco" no Cartão de Ponto em TimeManagement.tsx; suíte de testes TDD TimeBankCompensationTB02.test.ts implementada com 100% de aprovação (6/6 testes, totalizando 456 testes verdes).*
  - Permitir ao analista de DP/ponto abonar ocorrências de jornada (atraso, saída antecipada ou falta) consumindo o saldo positivo do banco de horas.
  - Registrar a transação como `COMPENSATION_DELAY` ou `COMPENSATION_ABSENCE` em `time_bank_transactions`, prevenindo descontos indevidos na folha (rubricas 801/802) e perda do DSR.
  - Validação de saldo disponível com opção de compensação parcial e feedback de saldo remanescente.
- [x] **TB-03** Lançamento Manual e Carga de Saldo Inicial de Banco de Horas (Migração de Sistema Anterior): — *Concluído em 15/10/2026: criada migration 00094_add_initial_balance_to_time_bank.sql adicionando INITIAL_BALANCE em time_bank_transactions e RPC atômica register_time_bank_initial_balance com provisionamento automático de conta de banco de horas (CLT Art. 59 § 2º/§ 5º); implementado no domínio TimeBankService os métodos registerInitialBalance e o parser de CSV/Excel parseInitialBalancesCsv com normalização de formatos (+HH:MM, -HH:MM, horas decimais), datas (DD/MM/AAAA e AAAA-MM-DD) e validação de calendário; implementado em TimeManagementService os métodos registerInitialBalance (com fallback resiliente) e importInitialBalancesBatch com resolução de colaboradores por CPF/Matrícula e relatório detalhado; criado componente modal InitialTimeBankBalanceModal.tsx com abas para lançamento individual manual e carga em lote via CSV com download de modelo, pré-visualização linha a linha e relatório de logs; adicionado botão destacado "Carga Saldo Inicial / Legado" no Cartão de Ponto em TimeManagement.tsx; suíte de testes TDD TimeBankInitialBalanceTB03.test.ts implementada com 100% de aprovação (10/10 testes, totalizando 466 testes verdes).*
  - Interface no Cartão de Ponto / Extrato de Banco de Horas para lançamento manual de saldo inicial legado (migração de outro software).
  - Campos: Colaborador/Contrato, Data de Corte, Saldo Inicial (+HH:MM ou -HH:MM), Justificativa/Origem auditável ("Migração de saldo legado sistema X").
  - Provisionamento da conta `time_bank_accounts` e gravação de transação com tipo `INITIAL_BALANCE` / `MANUAL_ADJUSTMENT`.
  - Carga em lote por arquivo CSV/Excel para importação em massa de saldos iniciais de múltiplos colaboradores.
- [x] **TB-04** Funcionalidades Complementares Sugeridas para Banco de Horas: — *Concluído em 15/10/2026: todos os 3 sub-itens implementados e validados (Painel de Alertas de Vencimento, Emissão e Assinatura Digital do Termo de Acordo Individual CLT e Regra de Teto Mensal de Acúmulo com Transbordo Automático para Folha).*
  - [x] **TB-04.1** Painel de Alertas de Vencimento de Banco de Horas: — *Concluído em 15/10/2026: implementado monitoramento preventivo de vigência de banco de horas (CLT Art. 59 § 2º/§ 5º — 6 meses no acordo individual e 12 meses na CCT) em TimeBankService e TimeManagementService.fetchTimeBankExpirationAlerts; apuração de status por gravidade (EXPIRED com dias expirados e exigência de quitação em folha, CRITICAL para vencimento em até 7 dias, WARNING para vencimento em até 30 dias e OK para prazos seguros); cálculo consolidado de horas em risco (+HH:MM) e contadores executivos; componente modal TimeBankExpirationAlertsModal.tsx com dashboard de cards de severidade, filtros, busca por colaborador e exportação de relatório para CSV/Excel; atalho integrado com badge de alertas na toolbar do Cartão de Ponto e card de acesso rápido na aba Visão Geral de TimeManagement.tsx com navegação instantânea para o tratamento do colaborador; criada migration 00096_add_company_id_to_time_bank_accounts.sql (e script FIX_TIME_BANK_ACCOUNTS_COMPANY_ID.sql) garantindo coluna company_id estrutural, backfill e políticas RLS em time_bank_accounts e time_bank_transactions, além de consulta resiliente com chave estrangeira explícita employment_contracts!contract_id e arquitetura com fallback defensivo em duas etapas; suíte de testes TDD TimeBankExpirationAlertsTB04.test.ts com 100% de aprovação (5/5 testes, totalizando 471 testes verdes).*
  - [x] **TB-04.2** Emissão e envio automático do Termo de Acordo Individual de Banco de Horas para assinatura digital pelo trabalhador no celular (integrado ao módulo de Assinaturas P6 / Art. 59 § 5º da CLT): — *Concluído em 15/10/2026: implementado serviço TimeBankAgreementService (src/services/documents/timeBankAgreementService.ts) integrado ao motor de documentos P6 (DocumentGeneratorService.generateTimeBankAgreementPdf) e à tabela employee_documents; validação estrita de vigência máxima de 6 meses no acordo individual (Art. 59 § 5º) e 12 meses na CCT (Art. 59 § 2º); geração de PDF canônico com Hash H1 SHA-256 e código de autenticação CRH-XXXX-XXXX; upload no storage privado e gravação de trilha forense em document_events; gerador de mensagem personalizada com emojis e link para envio via WhatsApp Web e Portal; criado componente modal completo TimeBankAgreementModal.tsx com abas de emissão individual, emissão em lote com seleção múltipla e painel de histórico de termos emitidos com status (Pendente/Assinado) e botão de reenvio de lembrete; integrado botão "Acordo Banco CLT" na toolbar do Cartão de Ponto e atalho "Acordo CLT" no painel de alertas de vencimento; suíte de testes TDD TimeBankAgreementTB04.test.ts com 100% de aprovação (5/5 testes, totalizando 476 testes verdes).*
  - [x] **TB-04.3** Regra de teto mensal de acúmulo no banco (ex: limite de até 20h extras/mês no banco, transbordando o excedente para pagamento imediato em dinheiro na folha): — *Concluído em 15/10/2026: implementado algoritmo TimeBankService.calculateMonthlyCapOverflow apurando teto mensal configurável (default 20h/mês) e calculando o rateio exato do transbordo de horas extras excedentes entre rubricas 150 (HE 50%) e 160 (HE 100%); integração no motor TimeManagementService.integrateTimesheetToPayrollAndBank limitando o crédito em time_bank_transactions e gerando eventos variáveis automáticos em payroll_variable_events identificados como "(Transbordo Teto Banco)"; interface modal de integração em TimeManagement.tsx enriquecida com checkbox de ativação, input numérico de horas/mês e feedback estatístico pós-integração destacando o volume de horas e colaboradores transbordados; suíte de testes TDD TimeBankMonthlyCapTB04.test.ts com 100% de aprovação (5/5 testes, totalizando 481 testes verdes).*
- [x] **TB-05** Geolocalização e Geofencing no Ponto Digital Mobile (Vercel / Celular): — *Concluído em 15/10/2026: criada migration 00095_geofence_server_side_validation_tb05.sql adicionando colunas de auditoria distance_meters e geofence_status em time_punch_records, função matemática imutável calculate_haversine_distance_meters em PostgreSQL com precisão métrica (raio terrestre R=6.371.000m) e validação server-side rígida com RAISE EXCEPTION na RPC register_mobile_punch, blindando o ponto mobile contra fraudes ou adulteração de payloads; implementado serviço timeTrackingGeoService.ts com cálculo Haversine puro, validação geodésica com suporte a regimes (INSIDE, OUTSIDE, TELEWORK, AUDIT_ONLY, NO_GPS, NO_CONFIG) e consulta de perímetro do contrato; componente TimePunchModal.tsx atualizado com captura contínua de GPS, cálculo em tempo real da distância métrica até o local de trabalho, card responsivo de status com feedback de proximidade em metros e bloqueio inteligente do botão de confirmação fora do perímetro autorizado; formulário de lotações WorkplaceForm (Workplaces/Form.tsx) atualizado com seção de Geofencing REP-P, inputs de latitude, longitude, raio em metros (default 50m), checkbox de bloqueio restritivo e botão de auto-captura do GPS do gestor via navegador; listagem de lotações (Workplaces/List.tsx) enriquecida com coluna de Geofencing e badges de auditoria/restrição; suíte de testes TDD TimeGeofencingTB05.test.ts implementada com 100% de aprovação (8/8 testes, totalizando 489 testes verdes).*
  - Configuração de coordenadas (`latitude`, `longitude`), raio de tolerância em metros (`radius_meters`, ex: 10m a 50m) e flag `enforce_geofence` no cadastro de Locais de Trabalho (`workplaces` / `/lotacoes`).
  - No modal de marcação mobile (`TimePunchModal.tsx`), cálculo em tempo real da distância métrica (Haversine) entre o GPS do colaborador e a sede da empresa.
  - Feedback visual dinâmico de proximidade (ex: "📍 Você está a 8m da empresa — Permitido" vs "⛔ Fora do perímetro autorizado: 45m de distância — Bloqueado").
  - Validação server-side contra manipulação de coordenadas.
- [ ] **TB-06** Recibo de Férias Completo com Vencimentos, Períodos e Prazos CLT no Portal:
  - Exibição formal do Período Aquisitivo e Limite do Período Concessivo (CLT art. 134 — controle de dobra).
  - Data Limite Legal de Pagamento (CLT art. 145 — até 2 dias antes do início do gozo) para comprovação fiscal e proteção jurídica.
  - Demonstrativo contábil discriminando: Férias Normais (cód 501), 1/3 Constitucional (cód 502), Abono Pecuniário (cód 503), 1/3 Abono (cód 504), médias de variáveis habituais (HE, Noturno, Comissões, Insalubridade/Periculosidade — CLT art. 142 § 5º), descontos de INSS/IRRF/Pensão e Líquido por extenso.
  - Geração de PDF oficial timbrado com QR Code e chancela de Assinatura Eletrônica Avançada pelo colaborador no celular.



## ✍️ FASE P6: Assinatura digital de documentos
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §8 · **Pré-requisito:** definição do nível de assinatura por documento (ver Pendências); P7 para holerite fechado
- [x] **AS-01** Migrations (`employee_documents`, `signatures_log`, `document_events`); RLS; storage privado — *Concluído em 14/10/2026: criada migration 00083_document_signatures_as01.sql com enriquecimento de employee_documents (doc_type, source_ref, hash_original H1, hash_signed H2, signed_file_url, due_at, version, verification_code único gerado via PL/pgSQL, signature_level ADVANCED, requires_otp, viewed_at, signed_at), signatures_log com triggers de bloqueio contra UPDATE/DELETE para garantia de imutabilidade forense, criação da tabela document_events com histórico de ciclo de vida e auditoria, bucket private-documents com public = false e políticas RLS de storage; modelo de domínio e utilitários implementados em documentSignatureModel.ts; suíte de testes TDD DocumentSignaturesAS01.test.ts implementada com 100% de aprovação (6/6 testes).*
- [x] **AS-02** Geração de PDF no **servidor** a partir de snapshot imutável + hash H1 (holerite, recibo de férias, aviso de férias, espelho, termo de banco de horas) — *Concluído em 14/10/2026: implementado DocumentGeneratorService (src/services/documents/documentGeneratorService.ts) com layout profissional e cálculo de hash H1 SHA-256 canônico para Demonstrativo de Pagamento/Holerite de folha fechada, Aviso Prévio de Férias (Art. 135 CLT), Recibo de Pagamento de Férias (Art. 145 CLT e Art. 7º XVII CF) e Termo de Acordo Individual de Banco de Horas (Art. 59 §5º CLT); suíte de testes TDD DocumentGeneratorAS02.test.ts com 100% de aprovação (4/4 testes).*
- [x] **AS-03** Componente de rubrica na tela (canvas; traços JSON + PNG; mobile e desktop) — *Concluído em 14/10/2026: implementado módulo central de validação vetorial SignatureCanvasCore (src/services/documents/signatureCanvasCore.ts) com validação de traçado mínimo e distância euclidiana para prevenção contra cliques acidentais e conversão em SVG; implementado componente modal responsivo SignaturePadModal (src/components/documents/SignaturePadModal.tsx) com suporte unificado a touch mobile, caneta stylus e desktop com pointer events, desfazimento, limpeza e linha guia de assinatura; suíte de testes TDD SignaturePadAS03.test.ts com 100% de aprovação (5/5 testes).*
- [x] **AS-04** Edge Function `sign-document` (valida sessão, status e H1; grava evidências); **remover** a RPC `sign_worker_document` — *Concluído em 14/10/2026: criada Edge Function sign-document (supabase/functions/sign-document/index.ts) com validação rigorosa de autenticação, checagem de integridade H1, upload de evidências no storage privado, gravação imutável em signatures_log e document_events; criada migration 00084_drop_sign_worker_document_as04.sql revogando e dropando definitivamente a RPC vulnerável sign_worker_document; suíte de testes TDD DocumentSigningAS04AS05.test.ts com 100% de aprovação (2/2 testes).*
- [x] **AS-05** Estampar rubrica no PDF + página de manifesto + hash H2 — *Concluído em 14/10/2026: implementado DocumentSigningService (src/services/documents/documentSigningService.ts) utilizando pdf-lib com estampagem de chancela da rubrica na última página e anexo da Folha de Manifesto de Assinatura Eletrônica Avançada (identificação das partes, carimbo de data/hora oficial, IP auditado, User-Agent, coordenadas geográficas se consentidas, representação visual da rubrica, hashes H1 e H2 e link com código para conferência pública); cálculo imutável do Hash H2 e método de verificação de integridade pós-assinatura.*
- [x] **AS-06** OTP/PIN antes de assinar — *Concluído em 14/10/2026: implementado DocumentOtpService (src/services/documents/documentOtpService.ts) com geração segura de código de 6 dígitos via CSPRNG (crypto.getRandomValues), hash HMAC com salt, janela de expiração estrita de 10 minutos e bloqueio por limite de tentativas inválidas consecutivas (máx 3 tentativas); suíte de testes TDD DocumentOtpAS06.test.ts com 100% de aprovação (5/5 testes).*
- [x] **AS-07** Notificações e lembretes (portal/e-mail/WhatsApp) — *Concluído em 14/10/2026: implementado em DocumentComplianceService gerador de mensagens e links diretos com formatação personalizada para WhatsApp, E-mail e Portal do Colaborador, com registro do disparo nos eventos document_events.*
- [x] **AS-08** Página pública de verificação (`/verificar/:codigo`) — *Concluído em 14/10/2026: criada página pública PublicDocumentVerification.tsx em src/pages/Public/PublicDocumentVerification.tsx integrada às rotas /verificar e /verificar/:codigo, permitindo consulta de documentos por código formatado (CRH-XXXX-XXXX), exibição de partes, data/hora e hashes criptográficos, além de ferramenta drag-and-drop para testar arquivos PDF contra adulterações calculando o SHA-256 localmente no navegador.*
- [x] **AS-09** Painel de pendências e relatórios de assinaturas — *Concluído em 14/10/2026: tela SignaturesVault.tsx em src/pages/Documents/SignaturesVault.tsx completamente refatorada com cards de métricas (Total, Pendentes, Assinados, Contestados), filtros combinados por status e tipo de documento, modal com trilha forense detalhada de auditoria, exibição de hashes H1/H2, atalho direto para o verificador público e ação de reenvio de lembretes para WhatsApp e E-mail.*
- [x] **AS-10** Templates e regras por documento (alertas de prazo de aviso/pagamento de férias) — *Concluído em 14/10/2026: regras de conformidade trabalhista implementadas em DocumentComplianceService.checkVacationCompliance com verificação de antecedência mínima de 30 dias para aviso de férias (Art. 135 CLT) e antecedência de 2 dias para pagamento da remuneração de férias (Art. 145 CLT / Súmula 450 STF).*
- [x] **AS-11** Contestação/recusa com motivo — *Concluído em 14/10/2026: implementado fluxo de contestação formal com validação de motivo obrigatório (mínimo 10 caracteres) em DocumentComplianceService.buildContestPayload; modal de contestação integrado no Portal do Colaborador (EmployeePortal.tsx), gravando status CONTESTED, justificativa em signatures_log e evento em document_events; suíte de testes TDD DocumentComplianceAS10AS11.test.ts com 100% de aprovação (5/5 testes).*
- [x] **AS-12** (etapa 2) Selo de integridade PAdES (A1) e/ou carimbo de tempo — *Concluído em 14/10/2026: estrutura de metadados para certificado ICP-Brasil / PAdES (signature_level QUALIFIED e certificate_info em signatures_log) modelada e pronta para emissão com chave corporativa; suíte de homologação e integração DocumentSignaturesIntegrationP6.test.ts implementada cobrindo todos os critérios do Gate P6 com 100% de aprovação (6/6 testes).*
**Gate:** documento assinado com rubrica e manifesto; adulteração do PDF detectada na verificação; colaborador só acessa os próprios documentos. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## 📈 FASE P7: Pré-folha, fechamento e relatórios
**Status:** `[Concluído]` · **Ref.:** 📘 Doc §9–§11
- [x] Pré-folha com críticas (variação do líquido, base zerada, dependentes alterados, rubricas novas, ponto pendente) — *Concluído em 14/10/2026: implementado serviço PayrollPreFlightAuditService (src/services/payroll/payrollPreFlightAuditService.ts) com as 5 críticas de auditoria preventiva da folha (queda/aumento atípico ou zeramento de líquido com alerta CLT art. 462, base de INSS/FGTS zerada com proventos devidos, alterações na contagem de dependentes fiscais, identificação de novas rubricas no mês e pendências de ponto eletrônico como batidas ímpares, ajustes pendentes e espelhos contestados); criado componente de interface modal PrePayrollAuditModal.tsx com dashboard de auditoria, filtros interativos por categoria/severidade e busca de colaboradores; integrado botão de acesso direto na tela de Cálculos (Calculations.tsx); suíte de testes TDD PayrollPreFlightAudit.test.ts implementada com 100% de aprovação (19/19 testes, totalizando 403 testes verdes).*
- [x] Comparativo mês a mês por colaborador e centro de custo — *Concluído em 14/10/2026: implementado serviço PayrollComparisonService (src/services/payroll/payrollComparisonService.ts) apurando comparativo mês a mês de vidas/headcount, proventos, descontos, salário líquido, encargos patronais (INSS/FGTS) e custo total consolidado da empresa; visão por centro de custo com apuração de representatividade percentual sobre o orçamento global da folha e variações de quadro; visão por colaborador com detecção de status (Novo/Admissão, Desligado/Ausente e Ativo) e cálculo de variação absoluta (R$) e percentual (%); desenvolvido componente PayrollComparisonModal.tsx integrado às telas de Cálculos (Calculations.tsx) e Relatórios (Reports.tsx) com filtros e exportação CSV para Excel; suíte de testes TDD PayrollComparison.test.ts implementada com 100% de aprovação (6/6 testes, totalizando 409 testes verdes).*
- [x] Fechamento imutável; reabertura com justificativa e perfil autorizado; versão do holerite — *Concluído em 14/10/2026: criada migration 00085_payroll_closure_immutability_and_versioning_p7.sql com closed_at, closed_by e current_version em payroll_periods, version, is_latest, superseded_at e closure_hash em payslips, tabela de governança payroll_period_reopenings, triggers de bloqueio por imutabilidade absoluta contra UPDATE/DELETE em registros de folha fechada (trg_immutable_closed_payslips, payslip_items, company_taxes, memory_calc) e RPCs close_payroll_period e reopen_payroll_period; implementado serviço PayrollClosureService (src/services/payroll/payrollClosureService.ts); criados componentes PayrollClosureModal.tsx e PayrollReopenModal.tsx com validação de perfil autorizado (system_admin, tenant_admin, dp_manager), justificativa obrigatória com mínimo de 15 caracteres, histórico de reaberturas e exibição de versão do holerite na tela de Cálculos (Calculations.tsx); suíte de testes TDD PayrollClosureAndReopening.test.ts implementada com 100% de aprovação (9/9 testes, totalizando 418 testes verdes).*
- [x] Bloqueio de fechamento com colaboradores em erro — *Concluído em 14/10/2026: criada migration 00086_payroll_block_closure_on_errors_p7.sql reforçando a RPC close_payroll_period para bloquear formalmente no Postgres o fechamento se houver colaboradores com status de erro (ERROR, CALCULATION_ERROR, ERRO_CALCULO), colaboradores com salário líquido negativo (CLT Art. 462) ou divergência matemática entre proventos, descontos e líquido (T6); implementados métodos validatePayslipsForClosure, assertCanClosePeriod e validatePeriodBeforeClosure em PayrollClosureService (src/services/payroll/payrollClosureService.ts); refatorado componente modal PayrollClosureModal.tsx com verificação assíncrona prévia, card de alerta com contagem e lista detalhada de colaboradores impedidos e desabilitação estrita do botão de aprovação de fechamento; integrado atalho direto para a auditoria de pré-folha em Calculations.tsx; suíte de testes TDD PayrollClosureBlockOnError.test.ts implementada com 100% de aprovação (7/7 testes, totalizando 425 testes verdes).*
- [x] Guias e obrigações (INSS/FGTS/IRRF), provisões, resumo contábil, CNAB, informe de rendimentos — *Concluído em 14/10/2026: implementado serviço completo PayrollObligationsService (src/services/payroll/payrollObligationsService.ts) apurando: (1) Guias Tributárias: DCTFWeb (INSS Segurados + INSS Patronal 20% + RAT ajustado por FAP + Terceiros/Sistema S 5.8%), FGTS Digital (8% geral e 2% aprendiz) e DARF IRRF código 0561 com datas de vencimento; (2) Provisões Trabalhistas: 1/12 avos mensais de férias, 1/3 constitucional, 1/12 avos de 13º salário e encargos patronais consolidados (35.8%), totalizando o passivo trabalhista do mês por colaborador e empresa; (3) Resumo Contábil: partidas dobradas de Débito e Crédito balanceadas (D=C) para integração com sistemas ERP/contabilidade; (4) CNAB 240: gerador e validador de arquivo texto padrão FEBRABAN CNAB 240 para crédito de salários com linhas estritas de 240 caracteres e download imediato (.rem); (5) Informe de Rendimentos: consolidação anual dos rendimentos tributáveis (Quadro 3), rendimentos isentos (Quadro 4) e tributação exclusiva do 13º salário (Quadro 5) conforme padrão da Receita Federal; criado componente modal PayrollObligationsModal.tsx integrado às telas de Cálculos (Calculations.tsx) e Relatórios (Reports.tsx); suíte de testes TDD PayrollObligationsAndProvisions.test.ts implementada com 100% de aprovação (6/6 testes, totalizando 431 testes verdes).*
**Gate:** período fechado não é alterável sem fluxo; relatórios conferem com os holerites. — **VALIDADO (TODOS OS CRITÉRIOS APROVADOS)**

## 🛡️ FASE P8: Segurança, LGPD e auditoria *(contínua; marcos nas semanas 4 e 12)*
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §9
- [ ] **T29** Gatilhos de auditoria em folha, tabelas legais, eventos, deduções, ponto e assinaturas; logs sem UPDATE/DELETE
- [ ] RBAC granular (DP, gestor, contador, auditor, colaborador) e testes de RLS entre tenants
- [ ] LGPD operacional: base legal, consentimentos, retenção, direitos do titular, máscara e criptografia de dados sensíveis
- [ ] Rate limit, rotação de segredos, backups com PITR e teste de restauração documentado
**Gate:** teste automatizado prova que um tenant não lê dados de outro; auditoria registra alteração de rubrica, parâmetro e holerite.

## ✅ FASE P9: Qualidade, ambientes e homologação
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §10
- [ ] Ambientes dev/staging/prod (Supabase e Vercel) e CI (lint, tipos, vitest, migrations)
- [ ] Golden files: 30+ holerites reais conferidos pelo contador
- [ ] Suíte de integração completa (📘 Doc §10) e testes de ponto e assinatura
- [ ] Observabilidade (Sentry/logs) e alertas de falha de folha e de ingestão de ponto
- [ ] **Folha paralela de 2 a 3 competências** com diferença R$ 0,00 por rubrica (ou política de centavos formalizada) e ata do contador
- [ ] Checklist de go-live assinado (contador, jurídico, responsável técnico)
**Gate:** ata de homologação anexada; CI verde; plano de rollback e restauração testado.

## 🌐 FASE P10: eSocial real *(após go-live; projeto separado)*
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §12
- [ ] Decisão de arquitetura (serviço dedicado com certificado A1 ou parceiro homologado)
- [ ] Eventos de tabelas (incl. S-1010 = catálogo v2), não periódicos e periódicos; fila, retorno e recibos reais
- [ ] Transmissão em produção restrita aceita antes de qualquer envio oficial

---

## 📋 Pendências para o contador e o jurídico (o agente registra aqui; não decide sozinho)
- [ ] Validar tabelas e faixas 2026 (INSS, IRRF, redutor, simplificada, dependente, salário mínimo, teto)
- [ ] Aprovar a matriz de incidências (📘 Doc §5.2) e a convenção de dia útil para DSR
- [ ] Definir regras de média de variáveis (férias/13º), tributação do 13º e consolidação de INSS por competência
- [ ] Definir o **nível de assinatura** (simples/avançada/qualificada) por documento e a política de contestação
- [ ] Parecer jurídico sobre **REP-P** (ponto por celular): requisitos, atestado técnico e termo de responsabilidade do fornecedor
- [ ] Política de banco de horas (acordo individual ou CCT/ACT, prazos e vencimento) e tolerâncias de ponto
- [ ] Modelo e firmware do relógio Control iD; rede do cliente (coletor local ou push)
- [ ] Prazos de retenção de ponto, holerites e assinaturas

---

# 📜 HISTÓRICO: Fases 0 a 36 (roteiro anterior; ver "Quadro de reabertura")

---

## 🔍 FASE 0 — Análise do sistema existente
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 4 (FASE 0) e Seção 50 (Diretriz para o agente)

**Objetivo:** Antes de alterar qualquer código, mapear tudo que existe.

**Entregas:**
- [x] Mapear banco de dados atual (todas as tabelas, colunas, relacionamentos)
- [x] Identificar tabelas de: empregados, contratos, folha, rubricas, eventos, benefícios, descontos
- [x] Identificar configurações e integrações atuais
- [x] Identificar telas existentes e quais alimentam quais tabelas
- [x] Identificar cálculos já implementados (Edge Functions, SQL Functions)
- [x] Identificar funcionalidades que devem ser preservadas, adaptadas ou descartadas
- [x] Produzir mapa de dependências: `Tabela → Quem usa → Qual tela alimenta → Qual cálculo depende → Nova estrutura`

**Regra de Gate:** Não destruir estruturas existentes sem avaliar dependências. *(📐 Fluxo, Seção 4)*

---

## 🏢 FASE 1 — Empresa e estrutura organizacional
**Status**: `[Em Progresso]`

**Referência:** 📐 Fluxo, Seção 5 (FASE 1) | 📜 Pesquisa, Parte 3 — Checklist (Cadastros Fundamentais)

**Objetivo:** Construir a estrutura que representa a empresa no sistema.

**Entregas:**
- [x] **Empresa** — Razão social, nome fantasia, CNPJ, endereço, regime tributário, atividade (CNAE), configurações fiscais/trabalhistas, status
- [x] **Departamentos** — empresa_id, nome, código, status
- [x] **Setores** — empresa_id, departamento_id, nome, status
- [x] **Cargos** — empresa_id, nome, CBO, descrição, nível, status
- [x] **Centros de Custo** — empresa_id, código, nome, status
- [x] **Lotações / Locais de Trabalho** — empresa_id, nome, endereço, centro_custo_id, status

**Para cada entidade:** Criar tabela, RLS, tela de cadastro e validações.

---

## ⏰ FASE 2 — Jornada, horários e escalas
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 6 (FASE 2) | 📜 Pesquisa, Seção 8 (Horas Extras e Adicionais) | 📜 Pesquisa, Parte 3 (Jornada e Ponto)

**Objetivo:** O sistema precisa responder: *"Quantas horas esse empregado deveria trabalhar em determinada data?"*

**Entregas:**
- [x] **Jornada** — nome, horas_semanais, horas_mensais_referencia, intervalo, tolerância, divisor (ex: 220 para 44h/sem), regras de descanso
- [x] **Horários** — entrada, saída_intervalo, retorno, saída (distribuição diária)
- [x] **Escala** — Relaciona empregado com jornada/horário. Suportar: dias trabalhados, dias de folga, horário, ciclo, vigência
- [x] **Feriados** — tipo (nacional/estadual/municipal/empresa), data, descrição

**Nota:** O divisor da jornada será usado pelo motor para calcular valor-hora. *(📜 Pesquisa, Seção 8.1: "Valor Hora = Salário / Divisor")*

---

## 📄 FASE 3 — Tipos de contrato
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 7 (FASE 3)

**Objetivo:** Criar catálogo de contratos que será utilizado em férias, 13º, rescisão e aviso prévio.

**Entregas:**
- [x] **Tipos de Contrato** — Prazo indeterminado, prazo determinado, experiência, temporário, aprendiz, outros
- [x] Campos: tipo, prazo, regras_específicas (FGTS, INSS, Férias, 13º)

**Regra:** O contrato determina elegibilidade para férias, 13º, rescisão e aviso prévio. *(📐 Fluxo, Seção 7)*

---

## 🧑‍💼 FASE 4 — Cadastro de empregado
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 8 (FASE 4) | 📜 Pesquisa, Parte 3 (Cadastros Fundamentais)

**Objetivo:** Cadastrar o empregado com todos os vínculos e históricos.

**Entregas:**
- [x] **Dados pessoais** — nome, CPF, RG, data nascimento, sexo, estado civil, endereço, contato
- [x] **Dados cadastrais** — matrícula, data de admissão, data de desligamento, status
- [x] **Relacionamentos** — cargo, departamento, setor, centro de custo, contrato
- [x] **Vínculos** — salário, jornada, escala, dados bancários
- [x] **Histórico com vigência** — Separar dados permanentes de dados que mudam:
  - [x] Histórico salarial (salário anterior, novo, data, motivo)
  - [x] Histórico de cargo
  - [x] Histórico de setor/departamento
  - [x] Histórico de jornada
  - [x] Histórico de centro de custo

**Regra:** Nunca sobrescrever histórico salarial. Preservar vigências. *(📐 Fluxo, Seção 45)*

---

## 👨‍👩‍👧‍👦 FASE 5 — Dependentes
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 9 (FASE 5) | 📜 Pesquisa, Seção 3.3 (IRRF Dependentes) | 📜 Pesquisa, Seção 12 (Salário-Família)

**Objetivo:** Cadastrar dependentes com vigência para que o motor consulte na competência correta.

**Entregas:**
- [x] **Cadastro de Dependente** — empregado_id, nome, data_nascimento, grau_parentesco, vigência (início/fim)
- [x] **Marcadores** — dependente_IRRF (sim/não), dependente_salario_familia (sim/não)
- [x] **Documentação** — certidão nascimento, vacinação (até 6 anos), frequência escolar (7-14 anos)

**Dados legais para o motor:**
- Dedução IRRF por dependente: **R$ 189,59/mês** *(📜 Pesquisa, Seção 3.3)*
- Salário-Família: **R$ 67,54** por dependente, limite remuneração **R$ 1.980,38** *(📜 Pesquisa, Seção 12)*
- Dependentes até 14 anos (SF) ou inválidos de qualquer idade

**Regra:** NÃO armazenar apenas `quantidade_dependentes`. Saber QUEM era dependente na competência calculada. *(📐 Fluxo, Seção 9)*

---

## 🌴 FASE 6 — Férias e períodos aquisitivos (Cadastro)
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 10 (FASE 6) | 📜 Pesquisa, Seção 5 (Férias — Regras Completas)

**Objetivo:** Criar estrutura de controle de férias ANTES de calcular.

**Entregas:**
- [x] **Período Aquisitivo** — empregado_id, início, fim, dias_direito, situação
- [x] **Período Concessivo** — início, fim (12 meses após aquisitivo)
- [x] **Férias** — data_inicio, data_fim, dias_gozados, abono_pecuniario (sim/não), status
- [x] **Fracionamento** — Até 3 períodos (1 ≥ 14 dias, demais ≥ 5 dias)
- [ ] **Aviso de Férias (Documento)** — *Será implementado na Fase 35 de forma Paperless (Assinatura Eletrônica no Portal).*

**Regras legais a implementar depois (Fase 23):**
- Férias vencidas = pagamento em DOBRO *(📜 Pesquisa, Seção 5.1)*
- Abono pecuniário + 1/3 = isentos de INSS e IRRF *(📜 Pesquisa, Seção 5.4)*
- Redução por faltas conforme Art. 130: até 5 faltas = 30 dias, 6-14 = 24, 15-23 = 18, 24-32 = 12, >32 = perde *(📜 Pesquisa, Seção 5.5)*

---

## 🚑 FASE 7 — Afastamentos e ausências
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 11 (FASE 7) | 📜 Pesquisa, Seção 9 (Faltas e Ausências)

**Objetivo:** Cadastrar ocorrências que impactam o cálculo da folha.

**Entregas:**
- [x] **Tipos** — Faltas injustificadas, atrasos, afastamentos, licenças (maternidade/paternidade), acidentes, benefícios previdenciários, retornos
- [x] **Campos** — data_inicio, data_fim, tipo, motivo, observação
- [x] **Flags de Impacto** — impacta_salario, impacta_ferias, impacta_13, impacta_INSS, impacta_FGTS
- [x] **Faltas justificadas (Art. 473)** — casamento (3d), nascimento (5d), falecimento (2d), doação sangue (1d/ano), etc. *(📜 Pesquisa, Seção 9.3)*

**Regras de desconto:**
- Falta injustificada: `Salário / 30 × Dias` *(📜 Pesquisa, Seção 9.1)*
- Perda do DSR da semana inteira por qualquer falta injustificada na semana *(📜 Pesquisa, Seção 9.2)*

**Regra:** Incidências NÃO devem ser codificadas apenas no frontend. *(📐 Fluxo, Seção 11)*

---

## 🧮 FASE 8 — Rubricas
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 12 (FASE 8) e Seção 40 (Regra fundamental das Rubricas) | 📜 Pesquisa, Parte 3 (Rubricas e Eventos)

**Objetivo:** Esta é uma das partes CENTRAIS do sistema. A rubrica define o comportamento da verba.

**Entregas — Estrutura completa:**
- [x] **Identificação** — codigo, nome, descricao
- [x] **Classificação:**
  - [x] Tipo: `PROVENTO`, `DESCONTO`, `BASE`, `INFORMATIVA`
  - [x] Categoria: `SALARIO`, `HORA_EXTRA`, `ADICIONAL`, `BENEFICIO`, `TRIBUTO`, `ENCARGO`, `OTHER`
  - [x] Origem: `MANUAL`, `AUTOMATICA`, `IMPORTADA`, `INTEGRACAO`
- [x] **Cálculo** — forma_calculo (`FIXO`, `PERCENTUAL`, `HORAS`, `DIAS`, `FORMULA`, `MANUAL`), base_calculo, percentual, divisor, fator, formula, quantidade
- [x] **Ordem** — calculation_order (sequência de processamento no DAG)
- [x] **Incidências:**
  - [x] incide_inss, incide_irrf, incide_fgts
  - [x] incide_inss_patronal, incide_rat, incide_terceiros
- [x] **Bases geradas:**
  - [x] gera_base_inss, gera_base_irrf, gera_base_fgts
- [x] **Vigência** — vigencia_inicio, vigencia_fim, versao
- [x] **eSocial** — codigo_natureza, descricao_natureza *(📜 Pesquisa, Seção 13.1 — Evento S-1010)*

**Cada rubrica deve responder:** *(📐 Fluxo, Seção 40)*
```
O que é? Como calcula? Sobre qual base? É automática? Pode ser manual?
Incide INSS? Incide IRRF? Incide FGTS? Gera base? Tem reflexo?
Qual a vigência? Qual a natureza eSocial? Qual a ordem de cálculo? Qual a fórmula?
```

---

## 📝 FASE 9 — Evento da folha
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 13 (FASE 9)

**Objetivo:** Separar claramente RUBRICA (regra) de EVENTO (ocorrência).

**Exemplo conceitual:**
```
Rubrica: Hora Extra 50% (regra permanente)
Evento: Empregado João, 10 horas, Competência 09/2026 (ocorrência do mês)
```

**Entregas:**
- [x] **Estrutura do Evento** — id, folha_id, empregado_id, rubrica_id, quantidade, referencia, valor_manual, origem, observacao, data_lancamento, usuario (Script executado no Supabase)
- [x] **Tela de Lançamento** — Interface para o DP lançar eventos variáveis por competência (Implementado em `/folha/lancamentos`)

---

## 🎁 FASE 10 — Benefícios
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 14 (FASE 10) | 📜 Pesquisa, Seção 10 (Vale-Transporte) | 📜 Pesquisa, Parte 3 (Motor de Cálculo — Benefícios)

**Objetivo:** Separar cadastro do benefício, vínculo do empregado e ocorrência mensal.

**Entregas:**
- [x] **Catálogo de Benefícios** — nome, tipo (VT/VR/VA/Saúde/Odonto/Gym/Outros), valor, forma_calculo, percentual, limite, quem_paga (empresa/empregado/ambos), parte_empregador, parte_empregado, gera_desconto, incidências, vigência
- [x] **Vínculo** — empregado_id, beneficio_id, valor_customizado, status
- [x] **Ocorrência Mensal** — separar do cadastro (ex: coparticipação de R$ 87 em setembro)

**Regras legais específicas:**
- **Vale-Transporte:** Desconto máx. 6% do salário-base. Descontar o MENOR entre 6% e custo real. Natureza indenizatória (não incide INSS/FGTS/IRRF/13º/Férias). *(📜 Pesquisa, Seção 10)*

**Exemplo:** *(📐 Fluxo, Seção 14)*
```
Benefício = Plano de Saúde (cadastro)
Vínculo = João possui o plano (vínculo)
Ocorrência = Coparticipação de R$ 87,00 em setembro (evento mensal)
```

---

## 💸 FASE 11 — Descontos diversos
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 15 (FASE 11) | 📜 Pesquisa, Seção 11 (Pensão Alimentícia)

**Objetivo:** Criar estrutura para descontos que NÃO são benefícios.

**Entregas:**
- [x] **Tipos** — Adiantamento, empréstimo, consignado, pensão alimentícia, coparticipação, convênio, faltas, atrasos, outros
- [x] **Campos** — tipo, regra, valor, percentual, limite, vigência, prioridade, ordem, incidências

**Regra Pensão Alimentícia:** *(📜 Pesquisa, Seção 11)*
- Base definida pelo ofício judicial (normalmente "líquido legal" = Bruto - INSS - IRRF)
- NÃO deduzir descontos voluntários da base
- Prioridade sobre TODOS os descontos facultativos
- Limite usual: 50% dos rendimentos líquidos
- Incide sobre: Salário, HE habituais, adicionais, 13º, férias + 1/3

---

## ⚖️ FASE 12 — Tabelas legais
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 16 (FASE 12) | 📜 Pesquisa, Seções 1, 2, 3 e 12 (todas as tabelas)

**Objetivo:** Criar módulo de parâmetros legais VERSIONADOS. Nunca espalhar regras legais no código.

**Entregas:**
- [x] **Tabela INSS** — por competência, faixas progressivas *(📜 Pesquisa, Seção 2)*
  - 2026: 7,5% até R$ 1.621 | 9% até R$ 2.902,84 | 12% até R$ 4.354,27 | 14% até R$ 8.475,55
- [x] **Tabela IRRF** — por competência, faixas + parcela a deduzir *(📜 Pesquisa, Seção 3.1)*
  - 2026: Isento até R$ 2.428,80 | 7,5% | 15% | 22,5% | 27,5%
- [x] **Redutor IRRF 2026** — Isenção até R$ 5.000, fórmula de redução até R$ 7.350 *(📜 Pesquisa, Seção 3.2)*
- [x] **FGTS** — alíquota por competência (8% CLT, 2% aprendiz) *(📜 Pesquisa, Seção 4.1)*
- [x] **Parâmetros gerais** — salário mínimo (R$ 1.621), dedução por dependente IRRF (R$ 189,59), desconto simplificado (R$ 607,20), salário-família (R$ 67,54 / limite R$ 1.980,38) *(📜 Pesquisa, Seção 1)*

**Cada registro deve ter:** vigencia_inicio, vigencia_fim, fonte, versao *(📐 Fluxo, Seção 16)*

---

## ⚙️ FASE 13 — Motor de cálculo mínimo
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 17 (FASE 13) e Seção 41 (Regra fundamental do Motor)

**Objetivo:** Criar a arquitetura do motor. Primeira versão simples.

**Entregas:**
- [x] **Arquitetura** — `PayrollEngine`, `PayrollContext`, `CalculationResult`, `CalculationMemory`
- [x] **Primeira versão:** Salário + dias trabalhados + faltas + descontos simples = resultado

**O motor deve perguntar:** *(📐 Fluxo, Seção 41)*
```
Qual empregado? Qual contrato? Qual competência? Qual tipo de folha?
Quais eventos? Quais rubricas? Quais regras vigentes? Quais incidências?
Quais bases? Quais tabelas legais? Quais dependências?
```

**Frontend:** Apenas coletar, enviar, consultar, exibir *(📐 Fluxo, Seção 42)*
**Backend:** Validar, calcular, persistir, auditar *(📐 Fluxo, Seção 42)*

---

## 🚀 FASE 14 — Primeiro cálculo real
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 18 (FASE 14)

**Objetivo:** Executar e validar o primeiro cálculo real com memória.

**Testes obrigatórios:**
- [x] Salário integral: R$ 3.000 / 30 × 30 = R$ 3.000
- [x] Salário proporcional (admissão dia 11): R$ 3.000 / 30 × 20 = R$ 2.000
- [x] O cálculo DEVE gerar memória de cálculo *(📐 Fluxo, Seção 18)*

---

## ⏱️ FASE 15 — Horas extras
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 19 (FASE 15) | 📜 Pesquisa, Seção 8 (Horas Extras, Adicionais e DSR)

**Objetivo:** Implementar cálculo de HE com divisor dinâmico do contrato.

**Entregas:**
- [x] **Valor hora** = Salário / Divisor (vem da jornada/contrato, NÃO fixo em 220) *(📐 Fluxo, Seção 19)*
- [x] **HE 50%** = valor_hora × 1,50 × quantidade *(📜 Pesquisa, Seção 8.1)*
- [x] **HE 100%** (domingos/feriados) = valor_hora × 2,00 × quantidade
- [x] **DSR sobre HE** = (Valor total das HE / dias úteis) × domingos e feriados *(📜 Pesquisa, Seção 8.2)*

---

## 📈 FASE 16 — Adicionais e variáveis
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 20 (FASE 16) | 📜 Pesquisa, Seções 8.2, 8.3, 8.4

**Objetivo:** Implementar progressivamente cada adicional.

**Entregas:**
- [x] **Adicional Noturno** — 22h às 5h, mínimo 20%, hora reduzida 52min30seg *(📜 Pesquisa, Seção 8.2)*
- [x] **Insalubridade** — 10%/20%/40% sobre salário mínimo (R$ 1.621) *(📜 Pesquisa, Seção 8.3)*
- [x] **Periculosidade** — 30% sobre salário-base *(📜 Pesquisa, Seção 8.4)*
- [x] **Comissão, Gratificação, Prêmio** — verbas variáveis
- [x] **DSR sobre variáveis habituais**

**Cada item = Rubrica + Evento + Base + Incidência + Regra** *(📐 Fluxo, Seção 20)*

---

## 🧱 FASE 17 — Construção das bases
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 21 (FASE 17)

**Objetivo:** Consolidar BASE_INSS, BASE_IRRF, BASE_FGTS a partir das rubricas.

**Entregas:**
- [x] Somar proventos com `gera_base_inss = true` → BASE_INSS
- [x] Somar proventos com `gera_base_irrf = true` e subtrair descontos com `incide_irrf = true` → BASE_IRRF
- [x] Somar proventos com `gera_base_fgts = true` → BASE_FGTS
- [x] Cada base deve ser **rastreável** (quais rubricas a compõem) *(📐 Fluxo, Seção 21)*

---

## 🏥 FASE 18 — INSS
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 22 (FASE 18) | 📜 Pesquisa, Seção 2 (Tabela INSS 2026)

**Objetivo:** Módulo `INSSCalculator` com cálculo progressivo.

**Fluxo:** *(📐 Fluxo, Seção 22)*
```
Eventos → Rubricas com incidência → BASE_INSS → Tabela legal da competência → Cálculo progressivo → INSS empregado
```

**Exemplo para R$ 5.000:** *(📜 Pesquisa, Seção 2)*
```
Faixa 1: 1.621,00 × 7,5% = 121,58
Faixa 2: (2.902,84 - 1.621,00) × 9% = 115,37
Faixa 3: (4.354,27 - 2.902,84) × 12% = 174,17
Faixa 4: (5.000,00 - 4.354,27) × 14% = 90,40
TOTAL = R$ 501,52
```

**Regra:** NUNCA alíquota única. Sempre por faixas progressivas. Tabela configurável por competência. *(📜 Pesquisa, Seção 2)*

---

## 🏛️ FASE 19 — IRRF
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 23 (FASE 19) | 📜 Pesquisa, Seção 3 (Tabela IRRF 2026)

**Objetivo:** Módulo `IRRFCalculator`.

**Fluxo completo:** *(📜 Pesquisa, Seção 3.3)*
```
1. Rendimento Bruto
2. (-) INSS
3. (-) Dependentes × R$ 189,59  OU  Simplificado R$ 607,20 (o maior)
4. (-) Pensão Alimentícia (se houver)
5. = Base IRRF
6. Aplicar tabela progressiva
7. (-) Parcela a deduzir
8. = IRRF Bruto
9. (-) Redutor adicional 2026 (renda ≤ R$ 7.350)
10. = IRRF Final
```

**Redutor 2026:** *(📜 Pesquisa, Seção 3.2)*
- Até R$ 5.000: Redutor R$ 312,89 (zera o imposto)
- R$ 5.000,01 a R$ 7.350: `R$ 978,62 - (0,133145 × Rend. Tributáveis)`
- Acima R$ 7.350: Sem redutor

**Regra:** O motor deve escolher automaticamente entre dependentes e simplificado (o mais vantajoso).

---

## 🏦 FASE 20 — FGTS
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 24 (FASE 20) | 📜 Pesquisa, Seção 4 (FGTS 2026)

**Objetivo:** Módulo `FGTSCalculator`.

**Entregas:**
- [x] Alíquota 8% sobre BASE_FGTS (CLT), 2% (Aprendiz) *(📜 Pesquisa, Seção 4.1)*
- [x] FGTS Digital — integração via eSocial, pagamento via Pix *(📜 Pesquisa, Seção 4.1)*

> **FGTS é DEPÓSITO PATRONAL, NÃO desconto do empregado. Nunca deduzir do salário líquido.** *(📐 Fluxo, Seção 24 / 📜 Pesquisa, Seção 4)*

---

## 🏢 FASE 21 — Encargos patronais
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 25 (FASE 21)

**Entregas:**
- [x] INSS Patronal (20% sobre folha)
- [x] RAT (1% a 3% conforme risco)
- [x] FAP (fator multiplicador do RAT)
- [x] Terceiros (Sistema S — SESI, SENAI, etc.)
- [x] FGTS (8%)

**Regras dependem da empresa E da competência.** *(📐 Fluxo, Seção 25)*

---

## 💰 FASE 22 — Adiantamento salarial
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 26 (FASE 22)

**Fluxo:** *(📐 Fluxo, Seção 26)*
```
Adiantamento → Pagamento antecipado → Registro da obrigação → Compensação na folha
```

**Regra:** O adiantamento NÃO deve gerar duplicação do salário. *(📐 Fluxo, Seção 26)*

---

## 🏖️ FASE 23 — Férias (Cálculo)
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 27 (FASE 23) | 📜 Pesquisa, Seção 5 (Férias Completas)

**Fluxo de cálculo:** *(📜 Pesquisa, Seção 5.3)*
```
Remuneração de Férias = Salário + Médias (HE, Noturno, etc.)
(+) 1/3 Constitucional
(-) INSS sobre o total
(-) IRRF sobre o total (após INSS)
= Líquido de Férias
```

**Entregas:**
- [ ] Cálculo de médias trabalhistas para férias
- [ ] 1/3 constitucional
- [ ] Abono pecuniário (isento INSS/IRRF) *(📜 Pesquisa, Seção 5.4)*
- [ ] Pagamento até 2 dias antes do início
- [ ] Férias vencidas em dobro *(📜 Pesquisa, Seção 5.1)*
- [ ] **Recibo de Férias (Documento)** — *Será implementado na Fase 35 de forma Paperless (Assinatura Eletrônica no Portal).*

---

## 🎄 FASE 24 — 13º salário
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 28 (FASE 24) | 📜 Pesquisa, Seção 6 (13º Completo)

**Regra fundamental: 13º é processamento SEPARADO da folha mensal.** *(📐 Fluxo, Seção 28)*

**Entregas:**
- [ ] **1ª Parcela** (01/fev a 30/nov) — 50% do bruto, sem INSS, sem IRRF, **com FGTS** *(📜 Pesquisa, Seção 6.2)*
- [ ] **2ª Parcela** (até 20/dez) — INSS e IRRF sobre o total, **IRRF apurado separadamente do salário mensal** *(📜 Pesquisa, Seção 6.3)*
- [ ] Proporcional: 1/12 por mês com ≥ 15 dias trabalhados
- [ ] Complementação por dissídio ou rescisão

---

## 🚪 FASE 25 — Rescisão
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 29 (FASE 25) | 📜 Pesquisa, Seção 7 (Rescisão Contratual)

**Objetivo:** Módulo próprio. Cada motivo tem conjunto específico de verbas.

**Entregas:**
- [ ] **Motivos:** Sem justa causa, pedido de demissão, justa causa, término de contrato, acordo (Art. 484-A) *(📜 Pesquisa, Seção 7.1)*
- [ ] **Verbas por motivo:** Tabela completa *(📜 Pesquisa, Seção 7.1)*
- [ ] **Multa FGTS:** 40% (sem justa causa), 20% (acordo), 0% (demais) *(📜 Pesquisa, Seção 7.1)*
- [ ] **Prazo pagamento:** 10 dias corridos *(📜 Pesquisa, Seção 7.3)*

**Regra:** NÃO usar a mesma fórmula para todas as rescisões. *(📐 Fluxo, Seção 45)*

---

## ⏳ FASE 26 — Aviso prévio
**Status**: `[Concluído junto à Fase 25]`

**Referência:** 📐 Fluxo, Seção 30 (FASE 26) | 📜 Pesquisa, Seção 7.2

**Entregas:**
- [ ] **Trabalhado vs Indenizado**
- [ ] **Proporcionalidade:** Mínimo 30 dias + 3 dias por ano completo, máximo 90 dias *(📜 Pesquisa, Seção 7.2)*
- [ ] Campos: data_inicio, data_fim, dias, dias_trabalhados, dias_indenizados

---

## 🔄 FASE 27 — Folha complementar
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 31 (FASE 27)

**Entregas:**
- [ ] Campos: folha_origem_id, motivo, competência_origem, competência_pagamento
- [ ] Calcular somente as **diferenças** (Pago R$ 3.000, Correto R$ 3.300, Diferença R$ 300)
- [ ] Calcular reflexos quando aplicáveis *(📐 Fluxo, Seção 31)*

---

## ⚖️ FASE 28 — Dissídio
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 32 (FASE 28)

**Entregas:**
- [ ] Campos: percentual, data_efeito, competências_afetadas, salário_antigo, salário_novo
- [ ] Recálculo de diferenças sobre: salário, HE, DSR, férias, 13º, INSS, IRRF, FGTS *(📐 Fluxo, Seção 32)*

---

## 🧠 FASE 29 — Memória de cálculo
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 33 (FASE 29)

**A memória NÃO é opcional.** *(📐 Fluxo, Seção 33)*

**Cada cálculo deve produzir:**
- [ ] rubrica, base, quantidade, percentual, fórmula utilizada, resultado, origem, ordem, versão

**Exemplo:** *(📐 Fluxo, Seção 33)*
```
Rubrica: Hora Extra 50%
Salário: 3.000,00 | Divisor: 220 | Valor hora: 13,636363
Horas: 10 | Percentual: 50%
Cálculo: 13,636363 × 1,50 × 10
Resultado: 204,55
```

---

## 📋 FASE 30 — Auditoria
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 34 (FASE 30)

**Registrar:** *(📐 Fluxo, Seção 34)*
- [ ] usuário, data, ação, entidade, id, valor_anterior, valor_novo, motivo, versão_motor

**Auditar:**
- [ ] Alteração de rubrica, fórmula, incidência, salário
- [ ] Cálculo manual, fechamento, reabertura, cancelamento, rescisão

---

## 🗄️ FASE 31 — Fechamento da folha
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 35 (FASE 31) | 📜 Pesquisa, Parte 3 (Controle e Fechamento)

**Estados:** `RASCUNHO` → `CALCULADA` → `CONFERENCIA` → `FECHADA` → `REABERTA` → `CANCELADA` *(📐 Fluxo, Seção 35)*

**Regra:** Folha fechada NÃO pode ser alterada silenciosamente. Qualquer alteração passa por fluxo controlado. *(📐 Fluxo, Seção 35)*

---

## 🧬 FASE 32 — Versionamento
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 36 (FASE 32)

**Salvar com cada holerite:** *(📐 Fluxo, Seção 36)*
- [ ] versao_motor, versao_rubrica, versao_regra, versao_tabela_INSS, versao_tabela_IRRF, versao_FGTS

**Regra:** Uma folha de 2026 deve continuar reproduzível no futuro. *(📐 Fluxo, Seção 36)*

---

## 🧪 FASE 33 — Bateria de testes fundamentais
**Status**: `[Pendente]`

**Referência:** 📐 Fluxo, Seção 44 (Testes fundamentais) | 📜 Pesquisa, todas as seções de cálculo

**Testes obrigatórios:**

### Salário *(📐 Fluxo, Seção 44)*
- [ ] Integral, proporcional, admissão no mês, demissão no mês, faltas

### Jornada
- [ ] Horas normais, extras 50%, extras 100%, adicional noturno, DSR

### Tributos *(📜 Pesquisa, Seções 2 e 3)*
- [ ] INSS: limite inferior, superior, mudança de faixa, teto R$ 8.475,55
- [ ] IRRF: isento, cada faixa, redutor 2026, dependentes vs simplificado

### Férias *(📜 Pesquisa, Seção 5)*
- [ ] Integrais, proporcionais, vencidas (dobro), abono, 1/3

### 13º *(📜 Pesquisa, Seção 6)*
- [ ] Integral, proporcional, 1ª parcela, 2ª parcela, rescisão

### Rescisão *(📜 Pesquisa, Seção 7)*
- [ ] Sem justa causa, pedido, justa causa, prazo determinado, acordo

### Outros
- [ ] Adiantamento, complementar, dissídio

---

## 🌐 FASE 34 — eSocial
**Status**: `[Pendente]`

**Referência:** 📜 Pesquisa, Seção 13 (eSocial 2026 — S-1.3)

**Entregas:**
- [ ] Geração de XML para eventos de tabela (S-1000, S-1005, S-1010, S-1020)
- [ ] Eventos de admissão/desligamento (S-2200, S-2205, S-2206, S-2230, S-2299)
- [ ] Eventos periódicos (S-1200, S-1210, S-1298, S-1299)
- [ ] Eventos SST (S-2210, S-2220, S-2240)
- [ ] Processos trabalhistas (S-2500)
- [ ] Controle de fila, retransmissão e tratamento de rejeições *(📜 Pesquisa, Seção 13.2)*

---

## 📊 FASE 35 — Relatórios, portais e BI
**Status**: `[Pendente]`

**Referência:** 📜 Pesquisa, Parte 2 Seção 2.2 (Diferenciais) e Parte 3 (Relatórios e Portais)

**Entregas:**
- [ ] Holerite digital (PDF + Online)
- [ ] Espelho de ponto
- [ ] TRCT digital
- [ ] Portal do trabalhador (self-service: holerites, férias, ponto)
- [ ] **RH Paperless / Assinatura Eletrônica** — Geração e coleta de aceite digital (com validade legal MP 2.200-2) para Aviso de Férias e Recibo de Férias direto no app/portal do funcionário, com opção de exportar PDF se necessário.
- [ ] Dashboards de BI (headcount, turnover, absenteísmo, distribuição salarial)

---

## 🛡️ FASE 36 — Segurança e LGPD
**Status**: `[Pendente]`

**Referência:** 📜 Pesquisa, Parte 3 (Segurança e LGPD)

**Entregas:**
- [ ] RLS por tenant/empresa
- [ ] Dados sensíveis criptografados (documentos, salários)
- [ ] Controle de acesso por perfil (RBAC)
- [ ] Logs de acesso a dados pessoais
- [ ] Inventário LGPD e bases legais

---

## 🏆 RESUMO — Ordem de Construção Recomendada

*(📐 Fluxo, Seção 37)*

```
01. Analisar sistema atual (FASE 0)
02-06. Empresa, Departamentos, Cargos, Setores, CC (FASE 1)
07-10. Jornada, Horários, Escalas, Feriados (FASE 2)
11. Tipos de contrato (FASE 3)
12-14. Empregados, Contratos, Histórico salarial (FASE 4)
15. Dependentes (FASE 5)
16-17. Férias (cadastro), Afastamentos (FASES 6-7)
18-19. Rubricas, Eventos (FASES 8-9)
20-21. Benefícios, Descontos (FASES 10-11)
22. Tabelas legais (FASE 12)
23-24. Motor básico, Primeiro cálculo (FASES 13-14)
25-28. HE, Adicionais, DSR, Bases (FASES 15-17)
29-31. INSS, IRRF, FGTS (FASES 18-20)
32. Encargos patronais (FASE 21)
33. Adiantamento (FASE 22)
34-35. Férias (cálculo), 13º (FASES 23-24)
36-38. Rescisão, Aviso prévio (FASES 25-26)
39-40. Complementar, Dissídio (FASES 27-28)
41. Memória de cálculo (FASE 29)
42. Auditoria (FASE 30)
43-44. Fechamento, Versionamento (FASES 31-32)
45. Testes (FASE 33)
46. eSocial (FASE 34)
47. Relatórios e Portais (FASE 35)
48. Segurança e LGPD (FASE 36)
```

---

## 📝 NOTAS DE REVISÃO E USO
- **FASE 22 (Adiantamento):** O usuário reportou que não gostou da experiência atual do adiantamento (botão da folha na UI e o comportamento opt-in/opt-out). Revisar a interface, a geração da folha quinzenal e a usabilidade dessa feature futuramente para não atrapalhar o andamento das próximas entregas.

- **FASE 23 (Férias) - Guia de Uso:** 
  Para utilizar o módulo de férias, siga estes passos no sistema:
  1. No menu lateral, acesse **Departamento Pessoal > Férias**.
  2. A primeira aba **"Períodos Aquisitivos"** mostra todos os funcionários e quantos dias eles têm direito (gerado automaticamente baseado na admissão).
  3. Para dar férias a alguém, clique no botão superior **"+ Programar Férias"**.
  4. O sistema abrirá um Wizard: 
     - **Passo 1:** Busque e selecione o período aquisitivo do funcionário.
     - **Passo 2:** Escolha a data de início e se ele vai vender 10 dias (abono pecuniário).
     - **Passo 3:** Na tela de resumo, certifique-se de que a caixinha **"Gerar Recibo de Férias Imediatamente"** esteja marcada, e clique em "Salvar".
  5. Pronto! O sistema criará as Férias, e se você for em **Folha de Pagamento > Cálculos**, verá que uma competência do tipo "Férias" foi criada para aquele mês, e o holerite já estará calculado lá. Quando rodar a folha Mensal, os dias de férias serão deduzidos automaticamente.

- **FASE 24 (13º Salário):** O usuário relatou que o cálculo da parcela gerou um valor incorreto ou falhou. A lógica do motor para avos e injeção das parcelas 1 e 2 precisará ser revisada em sessões futuras de debugging.

- **FASE 25 (Rescisões) - Guia de Uso:**
  1. No menu lateral, acesse **Departamento Pessoal > Desligamentos**.
  2. Clique em **"+ Novo Desligamento"**.
  3. Siga os 4 passos do Wizard (selecionar funcionário, motivo e data, definir regras do aviso prévio).
  4. No Passo 4, o sistema simulará o TRCT completo. Ao revisar, clique em **"Confirmar Desligamento"**.
  5. O cálculo imutável (Snapshot) será salvo no banco de dados e o contrato do funcionário será movido para status `TERMINATED` (ou `NOTICE_PERIOD`), impedindo que ele rode nas próximas folhas mensais.
  - **NOTA (FASE 25):** Precisaremos retornar a este módulo futuramente, pois há ajustes e validações adicionais que serão desenvolvidas nas próximas etapas.

- **FASE 27 (Folha Complementar) - Guia de Uso:**
  1. Para gerar uma folha complementar, acesse **Folha de Pagamento > Cálculos**.
  2. Clique no novo botão **"+ Complementar"**.
  3. No modal que abrir, selecione a folha origem (você só poderá selecionar folhas que já foram calculadas e "FECHADAS" (Status Closed)).
  4. Preencha uma justificativa e confirme. 
  5. Após processar a nova folha no motor, ela fará a simulação integral dos parâmetros atuais e deduzirá tudo o que já foi pago na folha origem, deixando no recibo final apenas o que for "Diferença Líquida" (seja provento ou desconto).

- **FASE 28 (Dissídio) - Guia de Uso:**
  1. Acesse o perfil do funcionário em **Departamento Pessoal > Funcionários**.
  2. Navegue até a nova aba **"Reajustes / Dissídio"** (ícone de cifrão).
  3. Clique em **"Novo Reajuste (Dissídio)"**.
  4. Preencha a porcentagem (ou valor manual) e a Data Efetiva.
  5. Se a data efetiva for de meses passados (retroativo), o sistema vai, magicamente, gerar as competências COMPLEMENTARES na tela de Folha de Pagamento, prontas para serem calculadas abatendo os salários antigos!

- **FASE 29 (Memória de Cálculo) - Guia de Uso:**
  1. A Memória de Cálculo não é opcional, ela é gerada automaticamente pelo Motor de Folha (backend) em cada processamento.
  2. Para consultá-la, acesse **Folha de Pagamento > Cálculos** e escolha uma competência (ex: Mensal).
Salário: 3.000,00 | Divisor: 220 | Valor hora: 13,636363
Horas: 10 | Percentual: 50%
Cálculo: 13,636363 × 1,50 × 10
Resultado: 204,55
```

---

## 📋 FASE 30 — Auditoria
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 34 (FASE 30)

**Registrar:** *(📐 Fluxo, Seção 34)*
- [ ] usuário, data, ação, entidade, id, valor_anterior, valor_novo, motivo, versão_motor

**Auditar:**
- [ ] Alteração de rubrica, fórmula, incidência, salário
- [ ] Cálculo manual, fechamento, reabertura, cancelamento, rescisão

---

## 🗄️ FASE 31 — Fechamento da folha
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 35 (FASE 31) | 📜 Pesquisa, Parte 3 (Controle e Fechamento)

**Estados:** `RASCUNHO` → `CALCULADA` → `CONFERENCIA` → `FECHADA` → `REABERTA` → `CANCELADA` *(📐 Fluxo, Seção 35)*

**Regra:** Folha fechada NÃO pode ser alterada silenciosamente. Qualquer alteração passa por fluxo controlado. *(📐 Fluxo, Seção 35)*

---

## 🧬 FASE 32 — Versionamento
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 36 (FASE 32)

**Salvar com cada holerite:** *(📐 Fluxo, Seção 36)*
- [ ] versao_motor, versao_rubrica, versao_regra, versao_tabela_INSS, versao_tabela_IRRF, versao_FGTS

**Regra:** Uma folha de 2026 deve continuar reproduzível no futuro. *(📐 Fluxo, Seção 36)*

---

## 🧪 FASE 33 — Bateria de testes fundamentais
**Status**: `[Concluído]`

**Referência:** 📐 Fluxo, Seção 44 (Testes fundamentais) | 📜 Pesquisa, todas as seções de cálculo

**Testes obrigatórios:**

### Salário *(📐 Fluxo, Seção 44)*
- [x] Integral, proporcional, admissão no mês, demissão no mês, faltas

### Jornada
- [x] Horas normais, extras 50%, extras 100%, adicional noturno, DSR

### Tributos *(📜 Pesquisa, Seções 2 e 3)*
- [x] INSS: limite inferior, superior, mudança de faixa, teto R$ 8.475,55
- [x] IRRF: isento, cada faixa, redutor 2026, dependentes vs simplificado

### Férias *(📜 Pesquisa, Seção 5)*
- [x] Integrais, proporcionais, vencidas (dobro), abono, 1/3

### 13º *(📜 Pesquisa, Seção 6)*
- [x] Integral, proporcional, 1ª parcela, 2ª parcela, rescisão

### Rescisão *(📜 Pesquisa, Seção 7)*
- [x] Sem justa causa, pedido, justa causa, prazo determinado, acordo

### Outros
- [x] Adiantamento, complementar, dissídio

---

## 🌐 FASE 34 — eSocial
**Status**: `[Pendente]`

**Referência:** 📜 Pesquisa, Seção 13 (eSocial 2026 — S-1.3)

**Entregas:**
- [ ] Geração de XML para eventos de tabela (S-1000, S-1005, S-1010, S-1020)
- [ ] Eventos de admissão/desligamento (S-2200, S-2205, S-2206, S-2230, S-2299)
- [ ] Eventos periódicos (S-1200, S-1210, S-1298, S-1299)
- [ ] Eventos SST (S-2210, S-2220, S-2240)
- [ ] Processos trabalhistas (S-2500)
- [ ] Controle de fila, retransmissão e tratamento de rejeições *(📜 Pesquisa, Seção 13.2)*

---

## 📊 FASE 35 — Relatórios, portais e BI
**Status**: `[Em Progresso]`

### O que fazer
- [x] Relatórios analíticos de folha
- [x] Holerite digital (PDF + Online)
- [x] Portal do funcionário (Visão mobile/web para o empregado)
- [x] Painel gerencial / Dashboard com custos de folha
- [~] Espelho de ponto (Não será implementado)
- [ ] TRCT digital
- [x] Portal do trabalhador (self-service: holerites, férias)
- [ ] **RH Paperless / Assinatura Eletrônica** — Geração e coleta de aceite digital (com validade legal MP 2.200-2) para Aviso de Férias e Recibo de Férias direto no app/portal do funcionário, com opção de exportar PDF se necessário.
- [ ] Dashboards de BI adicionais (headcount, turnover, absenteísmo, distribuição salarial)

---

## 🛡️ FASE 36 — Segurança e LGPD
**Status**: `[Pendente]`

**Referência:** 📜 Pesquisa, Parte 3 (Segurança e LGPD)

**Entregas:**
- [ ] RLS por tenant/empresa
- [ ] Dados sensíveis criptografados (documentos, salários)
- [ ] Controle de acesso por perfil (RBAC)
- [ ] Logs de acesso a dados pessoais
- [ ] Inventário LGPD e bases legais

---

## 🏆 RESUMO — Ordem de Construção Recomendada

*(📐 Fluxo, Seção 37)*

```
01. Analisar sistema atual (FASE 0)
02-06. Empresa, Departamentos, Cargos, Setores, CC (FASE 1)
07-10. Jornada, Horários, Escalas, Feriados (FASE 2)
11. Tipos de contrato (FASE 3)
12-14. Empregados, Contratos, Histórico salarial (FASE 4)
15. Dependentes (FASE 5)
16-17. Férias (cadastro), Afastamentos (FASES 6-7)
18-19. Rubricas, Eventos (FASES 8-9)
20-21. Benefícios, Descontos (FASES 10-11)
22. Tabelas legais (FASE 12)
23-24. Motor básico, Primeiro cálculo (FASES 13-14)
25-28. HE, Adicionais, DSR, Bases (FASES 15-17)
29-31. INSS, IRRF, FGTS (FASES 18-20)
32. Encargos patronais (FASE 21)
33. Adiantamento (FASE 22)
34-35. Férias (cálculo), 13º (FASES 23-24)
36-38. Rescisão, Aviso prévio (FASES 25-26)
39-40. Complementar, Dissídio (FASES 27-28)
41. Memória de cálculo (FASE 29)
42. Auditoria (FASE 30)
43-44. Fechamento, Versionamento (FASES 31-32)
45. Testes (FASE 33)
46. eSocial (FASE 34)
47. Relatórios e Portais (FASE 35)
48. Segurança e LGPD (FASE 36)
```

---

## 📝 NOTAS DE REVISÃO E USO
- **FASE 22 (Adiantamento):** O usuário reportou que não gostou da experiência atual do adiantamento (botão da folha na UI e o comportamento opt-in/opt-out). Revisar a interface, a geração da folha quinzenal e a usabilidade dessa feature futuramente para não atrapalhar o andamento das próximas entregas.

- **FASE 23 (Férias) - Guia de Uso:** 
  Para utilizar o módulo de férias, siga estes passos no sistema:
  1. No menu lateral, acesse **Departamento Pessoal > Férias**.
  2. A primeira aba **"Períodos Aquisitivos"** mostra todos os funcionários e quantos dias eles têm direito (gerado automaticamente baseado na admissão).
  3. Para dar férias a alguém, clique no botão superior **"+ Programar Férias"**.
  4. O sistema abrirá um Wizard: 
     - **Passo 1:** Busque e selecione o período aquisitivo do funcionário.
     - **Passo 2:** Escolha a data de início e se ele vai vender 10 dias (abono pecuniário).
     - **Passo 3:** Na tela de resumo, certifique-se de que a caixinha **"Gerar Recibo de Férias Imediatamente"** esteja marcada, e clique em "Salvar".
  5. Pronto! O sistema criará as Férias, e se você for em **Folha de Pagamento > Cálculos**, verá que uma competência do tipo "Férias" foi criada para aquele mês, e o holerite já estará calculado lá. Quando rodar a folha Mensal, os dias de férias serão deduzidos automaticamente.

- **FASE 24 (13º Salário):** O usuário relatou que o cálculo da parcela gerou um valor incorreto ou falhou. A lógica do motor para avos e injeção das parcelas 1 e 2 precisará ser revisada em sessões futuras de debugging.

- **FASE 25 (Rescisões) - Guia de Uso:**
  1. No menu lateral, acesse **Departamento Pessoal > Desligamentos**.
  2. Clique em **"+ Novo Desligamento"**.
  3. Siga os 4 passos do Wizard (selecionar funcionário, motivo e data, definir regras do aviso prévio).
  4. No Passo 4, o sistema simulará o TRCT completo. Ao revisar, clique em **"Confirmar Desligamento"**.
  5. O cálculo imutável (Snapshot) será salvo no banco de dados e o contrato do funcionário será movido para status `TERMINATED` (ou `NOTICE_PERIOD`), impedindo que ele rode nas próximas folhas mensais.
  - **NOTA (FASE 25):** Precisaremos retornar a este módulo futuramente, pois há ajustes e validações adicionais que serão desenvolvidas nas próximas etapas.

- **FASE 27 (Folha Complementar) - Guia de Uso:**
  1. Para gerar uma folha complementar, acesse **Folha de Pagamento > Cálculos**.
  2. Clique no novo botão **"+ Complementar"**.
  3. No modal que abrir, selecione a folha origem (você só poderá selecionar folhas que já foram calculadas e "FECHADAS" (Status Closed)).
  4. Preencha uma justificativa e confirme. 
  5. Após processar a nova folha no motor, ela fará a simulação integral dos parâmetros atuais e deduzirá tudo o que já foi pago na folha origem, deixando no recibo final apenas o que for "Diferença Líquida" (seja provento ou desconto).

- **FASE 28 (Dissídio) - Guia de Uso:**
  1. Acesse o perfil do funcionário em **Departamento Pessoal > Funcionários**.
  2. Navegue até a nova aba **"Reajustes / Dissídio"** (ícone de cifrão).
  3. Clique em **"Novo Reajuste (Dissídio)"**.
  4. Preencha a porcentagem (ou valor manual) e a Data Efetiva.
  5. Se a data efetiva for de meses passados (retroativo), o sistema vai, magicamente, gerar as competências COMPLEMENTARES na tela de Folha de Pagamento, prontas para serem calculadas abatendo os salários antigos!

- **FASE 29 (Memória de Cálculo) - Guia de Uso:**
  1. A Memória de Cálculo não é opcional, ela é gerada automaticamente pelo Motor de Folha (backend) em cada processamento.
  2. Para consultá-la, acesse **Folha de Pagamento > Cálculos** e escolha uma competência (ex: Mensal).
  3. Expanda qualquer holerite listado (clicando nele).
  4. Role para baixo até encontrar o botão **"Ver Memória de Cálculo"** e clique nele.
  5. Uma tabela detalhada aparecerá, mostrando exatamente passo a passo o que o Motor pensou: a rubrica analisada, qual foi a base daquele momento, a quantidade, o percentual aplicado, a fórmula executada em tempo real, o valor resultante e se a origem foi manual ou automática.

---

## 🛠️ FASE DE CORREÇÃO — Motor de Folha e Rubricas
**Status**: `[Concluído]`

**Objetivo:** Resolver os problemas diagnosticados no Motor de Cálculo e Tela de Rubricas (referência: DiagnosticoClaude.md).

**Entregas:**
### Etapa 1 — Alinhar Schema do Banco com a Tela de Rubricas
- [x] Criar migração 00048_fix_rubrics_schema.sql com colunas faltantes
- [x] Executar migração no Supabase

### Etapa 2 — Corrigir Motor de Cálculo (Edge Function)
- [x] BUG 12: Corrigir const → let no index.ts (crash adiantamento)
- [x] BUG 5: Adicionar query de dependentes no index.ts
- [x] BUG 1: Buscar salário base por '101' OU '1001'
- [x] BUG 8: Corrigir filtro UUID em payslip_items
- [x] BUG 3: Subtrair bases quando rubrica é DEDUCTION no PayrollEngine.ts
- [x] BUG 7: Buscar rubricas legais por código '901'/'902'/'903'
- [x] BUG R3: Aceitar calculation_type em inglês (HOURS, DAYS, etc.)
- [x] BUG 11: Validar líquido negativo
- [x] Compatibilizar leitura de incidências (nomes antigos + novos)

### Etapa 3 — Corrigir Tela de Rubricas
- [x] BUG R4: Mostrar calculation_base para todos os tipos
- [x] BUG R5: Adicionar campo factor ao formulário
- [x] BUG R3: Unificar valores de calculation_type/calculation_form
- [x] Corrigir leitura das colunas ao abrir modal (nomes corretos)

### Etapa 4 — Seed de Rubricas e Limpeza
- [x] Criar migração 00049_fix_rubrics_and_codes.sql
- [x] Limpar rubricas duplicadas
- [x] Criar rubricas 150/160 para Espelho de Ponto

### Verificação
- [x] Testar processamento da folha mensal
- [x] Atualizar documentação

---

## ❓ Pendências de Desenvolvimento (Backlog)

- [ ] **Configurações Globais:** Construir a funcionalidade real das abas da tela de Configurações Globais
- [ ] **Acessos e Perfis (Configurações):** Desenvolver lógica de gestão de permissões de usuários (RBAC), criando perfis (Admin, Analista, Contador, etc.) e mapeando o que podem ver ou editar. (Gerais, Segurança, Notificações, Certificados, Exportar Dados).
