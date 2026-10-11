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