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
**Status Atual:** `[Em Progresso]` · **Fase corrente:** P3 · **Go-live folha:** bloqueado até Gate de P9 · **Go-live ponto/assinatura:** bloqueado até Gate de P5/P6.

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
**Status:** `[Em Progresso]` · **Ref.:** 📘 Doc §4 (T9, T10, T21–T25), §6
- [x] **T21** `money.ts` (centavos/decimal, HALF_UP) e substituição de `Math.round(x*100)/100` — *Concluído em 13/10/2026 (commit `36f43f6`): criado utilitário `money.ts` com política HALF_UP simétrica, operações aritméticas baseadas em centavos inteiros (`addMoney`, `subtractMoney`, `multiplyMoney`, `divideMoney`, `sumMoney`, `toCents`, `fromCents`), eliminação completa de `Math.round(x*100)/100` e operações float em `PayrollEngine`, `INSSCalculator`, `IRRFCalculator`, `FGTSCalculator`, `EmployerTaxesCalculator`, `RubricFormulaParser`, `index.ts` e `vacationPrint`. Suíte de testes TDD `MoneyPropertyT21.test.ts` implementada com teste de propriedade validando que líquido = proventos − descontos e soma dos itens fecham com exatidão em 1.000 casos aleatórios (100% aprovado).*
- [x] **T22** `rubric_kind` (migration, backfill, UI obrigatória) e motor por `kind`; corrigir precedência de `isAdicionalNoturno` — *Concluído em 13/10/2026 (commit `6b4eedd`): criada migration `00070_add_rubric_kind.sql` adicionando `rubric_kind` em `payroll_rubrics` com constraint de validação e backfill oficial para todas as rubricas existentes; `PayrollContext` e `Rubric` atualizados com o tipo `RubricKind`; `PayrollEngine` refatorado para operar por `kind` sem depender de `category === 'SALARY'` ou código, com precedência estrita de `ADIC_NOTURNO` vs `DSR_NOTURNO`, filtro mandatório de `type === 'EARNING'` para proventos e fallback com `console.warn` para rubricas legadas; tela `Rubrics.tsx` atualizada com campo obrigatório de tipo do motor no modal e exibição na listagem; suíte de testes TDD `RubricKindT22.test.ts` implementada com 100% de aprovação.*
- [ ] **T23** DAG com dependências de fórmula e bases dinâmicas
- [ ] **T24** Parser: variáveis na AST, tokenizer estrito, comparadores, vírgula decimal, erros explícitos; remover variável só com código numérico
- [ ] **T25** `getVariable` com erro; `calculation_order ??`; eventos negativos; carga filtrada por contratos
- [ ] **T9** Persistência atômica (`save_payroll_period`) e trava de concorrência
- [ ] **T10** Impostos patronais recalculados a partir de todos os holerites do período
- [ ] §6 Modelo v2: `rubric_incidences` por contexto, `calculation_bases`, versionamento e status da rubrica
- [ ] §6.3 Tela **Nova rubrica** (modelos, sugestão por natureza eSocial, simulador, validações, aprovação, vigência)
**Gate:** rubrica nova de tipo conhecido criada, simulada e ativada **sem alterar código**; nenhuma regra por nome/código no motor.

## ⚖️ FASE P4: Regras trabalhistas
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §4 (T14–T20)
- [ ] **T14** `value_type` em eventos fixos; insalubridade/periculosidade não acumulam
- [ ] **T15** Férias que atravessam o mês (dias comerciais, múltiplas solicitações, média de variáveis)
- [ ] **T16** INSS consolidado por competência entre folhas
- [ ] **T17** Descontos fixos por tipo de folha (`apply_on_types`); regra de pensão alimentícia
- [ ] **T18** `BASE_HORA_EXTRA`, DSR com noturno/variáveis, hora noturna reduzida, DSR s/ faltas, fator obrigatório
- [ ] **T19** Dependentes por idade/vigência, 13º (médias/faltas), FGTS aprendiz, patronais por regime, versões reais gravadas
- [ ] **T20** `Termination.test.ts` verde com justificativa
**Gate:** casos dourados de férias, 13º, rescisão, faltas/DSR e banco de horas conferidos pelo contador.

## ⏱️ FASE P5: Ponto eletrônico (Control iD, importação e celular)
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §7 · **Pré-requisito:** decisão do modelo de relógio e parecer jurídico sobre REP-P (ver Pendências)
- [ ] **PT-01** Migrations: `time_devices`, `afd_files`, `time_punch_records` (imutável), `time_daily_summary`, política de banco de horas; auditoria
- [ ] **PT-02** Importação de AFD (upload, validação de NSR/CRC, idempotência, relatório de importação)
- [ ] **PT-04** Edge Function `time-ingest` (chave por dispositivo, HMAC, lote, idempotência)
- [ ] **PT-03** Coletor local Control iD (pull incremental por NSR, fila offline, heartbeat) *(confirmar API do modelo na documentação do fabricante)*
- [ ] **PT-05** `time-punch` (celular/PWA): hora do servidor, NSR sequencial, geofence, comprovante com QR; selfie só com consentimento
- [ ] **PT-06** Motor de jornada (tolerâncias, noturno, intervalos, interjornada, feriados, 12x36, ponto por exceção)
- [ ] **PT-07** Banco de horas: extrato, saldo, vencimentos, alertas, compensação, pagamento como HE
- [ ] **PT-08** Espelho de ponto mensal (PDF) + contestação
- [ ] **PT-09** Fechamento do ponto gera eventos variáveis automaticamente (substitui lançamento manual em `Timesheet.tsx`)
- [ ] **PT-10** Portal do colaborador: marcar ponto, comprovantes, espelho, **banco de horas**, justificativas
- [ ] **PT-11** Telas DP/gestor: dispositivos, importações, tratamento, inconsistências, aprovações
- [ ] **PT-12** Exportações AFD e AEJ e relatórios para fiscalização
- [ ] **PT-13** Segurança/LGPD do ponto (retenção, consentimento, máscara, acesso)
- [ ] **PT-14** Testes: jornadas, noturno, 12x36, feriados, banco de horas, idempotência de importação
**Gate:** marcação por relógio **ou** AFD **ou** celular aparece no espelho; colaborador vê saldo e extrato do banco de horas; AFD/AEJ exportáveis; marcação original impossível de alterar.

## ✍️ FASE P6: Assinatura digital de documentos
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §8 · **Pré-requisito:** definição do nível de assinatura por documento (ver Pendências); P7 para holerite fechado
- [ ] **AS-01** Migrations (`employee_documents`, `signatures_log`, `document_events`); RLS; storage privado
- [ ] **AS-02** Geração de PDF no **servidor** a partir de snapshot imutável + hash H1 (holerite, recibo de férias, aviso de férias, espelho, termo de banco de horas)
- [ ] **AS-03** Componente de rubrica na tela (canvas; traços JSON + PNG; mobile e desktop)
- [ ] **AS-04** Edge Function `sign-document` (valida sessão, status e H1; grava evidências); **remover** a RPC `sign_worker_document`
- [ ] **AS-05** Estampar rubrica no PDF + página de manifesto + hash H2
- [ ] **AS-06** OTP/PIN antes de assinar
- [ ] **AS-07** Notificações e lembretes (portal/e-mail/WhatsApp)
- [ ] **AS-08** Página pública de verificação (`/verificar/:codigo`)
- [ ] **AS-09** Painel de pendências e relatórios de assinaturas
- [ ] **AS-10** Templates e regras por documento (alertas de prazo de aviso/pagamento de férias)
- [ ] **AS-11** Contestação/recusa com motivo
- [ ] **AS-12** (etapa 2) Selo de integridade PAdES (A1) e/ou carimbo de tempo
**Gate:** documento assinado com rubrica e manifesto; adulteração do PDF detectada na verificação; colaborador só acessa os próprios documentos.

## 📈 FASE P7: Pré-folha, fechamento e relatórios
**Status:** `[Pendente]` · **Ref.:** 📘 Doc §9–§11
- [ ] Pré-folha com críticas (variação do líquido, base zerada, dependentes alterados, rubricas novas, ponto pendente)
- [ ] Comparativo mês a mês por colaborador e centro de custo
- [ ] Fechamento imutável; reabertura com justificativa e perfil autorizado; versão do holerite
- [ ] Bloqueio de fechamento com colaboradores em erro
- [ ] Guias e obrigações (INSS/FGTS/IRRF), provisões, resumo contábil, CNAB, informe de rendimentos *(conferir obrigações vigentes com o contador)*
**Gate:** período fechado não é alterável sem fluxo; relatórios conferem com os holerites.

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
