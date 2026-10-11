# Documentação Central - coupleRH

## 1. Escopo do Projeto
O sistema **coupleRH** é uma plataforma SaaS/PWA responsiva, com a finalidade de administrar Recursos Humanos e Departamento Pessoal de empresas brasileiras regidas pela CLT.
A plataforma deve gerenciar vínculos trabalhistas, documentos, jornadas, folha de pagamento, férias, benefícios, rescisões, eSocial e SST.

## 2. Regras de Negócio Fundamentais
- **Conformidade Legal**: Nunca inventar regras, usar CLT e manuais oficiais.
- **Rastreabilidade**: Tudo deve ter versão, vigência, origem de alteração.
- **Auditoria**: Toda ação sensível deve gerar trilha imutável.
- **Multiempresa**: Isolamento estrito entre tenants, empresas e estabelecimentos (RLS no Supabase).
- **Tratamento de Dados (LGPD)**: Proteção de dados sensíveis e médicos, limitação de acesso de gestores a CID e atestados restritos.

## 3. Decisões Técnicas e Stack
- **Frontend**: React.js / Next.js com TailwindCSS + Shadcn/UI, focando em UX excepcional (Design System próprio, glassmorphism, microinterações).
- **Backend / BaaS**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security - RLS).
- **Hospedagem Frontend**: Vercel (Gratuito inicial).
- **Segurança**: Políticas RLS muito rigorosas, criptografia para dados de saúde, soft-delete para registros operacionais.

## 4. Evolução do Sistema (Histórico)
- **Fase Inicial**: Setup do projeto e autenticação básica.
- **Refatoração (Colaboradores)**: O fluxo de Onboarding foi removido. Colaboradores agora são cadastrados diretamente quando aprovados, simplificando a tela de listagem para exibição apenas dos ativos.
- **04/09/2026**: Inicialização do projeto, criação dos artefatos básicos de gestão (fase.md, documentacao.md, database.md), e definição da stack tecnológica (React + Supabase + Vercel).

## Histórico de Alterações
- Hotfix: Adicionada a coluna receives_advance na tabela employment_contracts para resolver erro em produção (schema cache).
- Hotfix: Adicionada a coluna workplace_id na tabela employment_contracts para resolver erro em produção.
- Hotfix/Sincronização: Executada auditoria completa da base (script 07_missing_columns_sync.sql) para corrigir colunas ausentes reportadas pelo sistema (employment_contracts, payroll_rubrics, work_schedules, payroll_periods, employment_contract_history, payroll_memory_calc).
- Hotfix: Adicionada a RPC authenticate_employee (arquivo 08_employee_portal_auth_sync.sql) no banco de produção. Atualizado manifest.json para corrigir navegação de PWA.
- **11/10/2026 - Fase P0 / Tarefa T26 (Contenção de Riscos - eSocial)**: Rotulado painel de mensageria eSocial como modo de simulação explícito ("Simulação: não transmite ao governo"), desativado botão de transmissão em lote em produção com bloqueio preventivo (`validateTransmissionAttempt`), criada a migration `00066_anular_recibos_ficticios_esocial.sql` para sanitização de recibos sintéticos com preservação da trilha em `audit.logs`, e adicionada suíte de testes unitários `ESocialSimulation.test.ts`.
- **11/10/2026 - Fase P0 / Tarefa T8 (Segurança do Motor - payroll-engine)**: Implementada validação mandatória de token JWT via `auth.getUser()`, autorização RBAC checando se o usuário pertence ao `tenant_id` da competência com papéis autorizados (`system_admin`, `tenant_admin`, `dp_analyst`), restrição de CORS para origens confiáveis sem uso de wildcard (`*`), e remoção do campo `debug` da resposta da Edge Function para evitar vazamento de memória e logs internos. Testes adicionados em `EngineSecurity.test.ts`.
- **11/10/2026 - Fase P0 / Tarefa T5 (Tratamento Explícito de Erros de Cálculo)**: O motor agora identifica rubricas com falha de fórmula/cálculo e injeta o código e nome (`[Rubrica {code} - {name}]`) no status de erro. O `payroll-engine` não grava mais holerite zerado (`total_earnings: 0`, `net_salary: 0`) quando o cálculo falha, acumula as ocorrências em `errors[]` e responde HTTP 422 sem marcar o período como `CALCULATED` (permanece em `DRAFT`). `Calculations.tsx` atualizado para exibir as mensagens de erro detalhadas. Testes unitários adicionados em `CalculationErrorHandling.test.ts`.
- **11/10/2026 - Fase P0 / Tarefa T27 (provisório) (Segurança de Assinatura de Documentos)**: Revogada a permissão de execução da RPC `sign_worker_document` para `anon`, `authenticated` e `public` via migration `00067_revoke_sign_worker_document.sql`, mitigando a vulnerabilidade B7 (assinatura fraca sem conferência estrita de identidade, rubrica e manifesto no servidor). O portal do colaborador (`EmployeePortal.tsx`) foi atualizado para informar a atualização de segurança em andamento até a entrega oficial do módulo AS-04 (Fase P6). Testes unitários adicionados em `SignatureRpcSecurity.test.ts`.
- **11/10/2026 - Fase P0 / Anexo A (Diagnóstico do Banco de Dados de Produção) e Conclusão do Gate P0**: Extração autenticada realizada no Supabase de produção gerando `docs/verificacao_banco.md`. Identificadas 42 rubricas cadastradas, 1 versão legal ativa (2026) com faixas progressivas de INSS e IRRF. Confirmado: 0 holerites zerados em status CALCULATED, 0 inconsistências de soma de itens vs cabeçalhos e 0 recibos fictícios no eSocial. Todos os 5 critérios do Gate da Fase P0 foram concluídos e aprovados.
- **11/10/2026 - Fase P1 / Tarefa T1 (Correção Crítica de IRRF no Motor e Calculador)**: Resolvido o bloqueador B1. No `PayrollEngine.ts`, a base bruta do IRRF agora é preservada antes do cálculo do INSS e a mutação `this.context.base_irrf -= inssResult.value` foi eliminada. O valor real de INSS é enviado ao `IRRFCalculator.calculate()`. No calculador, a dedução legal e a dedução simplificada (R$ 607,20 em 2026) são comparadas a partir do rendimento bruto para eleger a menor base de cálculo sem sobreposição indevida; o redutor de 2026 (isenção até R$ 5.000 e fórmula progressiva até R$ 7.350) é aplicado estritamente sobre o rendimento bruto. A base legal pós-deduções é gravada em `bases.irrf`. A suíte `PayrollEngineIRRF.test.ts` valida os 6 cenários da tabela do 📘 Doc §4 (100% aprovados).
- **11/10/2026 - Fase P1 / Tarefa T2 (Isolamento de Rubricas por Colaborador)**: Corrigido o vazamento de estado em cálculos consecutivos na mesma execução. No `PayrollContext` e no loop de contratos do `index.ts`, o array de rubricas agora é clonado via `structuredClone()`. Dentro do `PayrollEngine.ts`, foram eliminadas todas as atribuições em `rubric.*` (como `rubric.percentage`, `rubric.calculation_base`, `rubric.factor`), passando a operar com variáveis locais imutáveis. O teste `RubricIsolation.test.ts` valida que contratos subsequentes calculam percentuais dinâmicos (como DSR de 25% e 16%) sem herança espúria do contrato anterior.