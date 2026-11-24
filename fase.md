# Fases de Desenvolvimento — coupleRH v2.0 Enterprise (PostgreSQL 17 Puro + VPS Oracle ARM64)

Este documento é o **roteiro oficial de desenvolvimento** da nova versão do **coupleRH v2.0 Enterprise**, 100% código aberto (**PostgreSQL 17 puro + Node.js 22 / Fastify / `pg-boss` + React 19 / Vite + Caddy 2**), projetado para operar em **VPS Oracle Cloud Always Free (ARM64)** em um **novo repositório Git limpo** e no padrão técnico de **Apdata / TOTVS / ADP**.

---

## 📌 Documento Mestre de Referência (Leitura Obrigatória)

- 🌐 **Novo Repositório Oficial v2.0 (Produção VPS):** `https://github.com/cf95souza/CoupleRHVPS.git` *(nasce de `git init -b main` zerado — jamais fazer push do histórico legado)*
- 📗 **Especificação Técnica, Arquitetura, Algoritmos, SQL e Critérios TDD:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) *(citado neste roteiro como **📗 Blueprint v2.0**)*
- 📘 **Controle Contínuo:** [`documentacao.md`](./documentacao.md) e [`database.md`](./database.md)

> **Como saber exatamente onde estamos mexendo:** cada tarefa abaixo traz um código rastreável (`REPO-01`, `VPS-02`, `SEC-03`, `RBAC-02`, `BUG-01`, `FOLHA-03`, `CONT-02`, `PONTO-01`, `ESOC-03`, `ENT-01`...) cuja especificação completa (diagnóstico do legado, arquitetura, algoritmo, schema SQL e critério de aceite TDD) está na seção correspondente de **`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`**.

---

## 🎯 Princípio Central & Regras Absolutas de Engenharia (v2.0)

> **Princípio Central:** Cadastro define a realidade. Regra define o comportamento. Evento registra o que aconteceu. Motor calcula. Folha registra o resultado. Memória explica como o resultado foi obtido.

- 🚫 **ZERO Supabase e ZERO Vercel:** 100% código aberto com **PostgreSQL 17 puro** (`postgres:17-alpine`), API REST/Worker Node.js 22 (Fastify + `pg` + `pg-boss`) e Caddy 2. O browser **nunca** acessa o banco diretamente.
- 🚫 **NENHUMA regra de cálculo legal** (INSS, IRRF, FGTS, encargos, férias, 13º, rescisão, médias, pensão) no frontend.
- 🚫 **NUNCA usar `eval()`, `new Function()` ou SQL dinâmico** para fórmulas — apenas AST segura (`RubricFormulaParser`).
- 🚫 **NUNCA usar `float` para valores monetários** — operar exclusivamente via `money.ts` (centavos inteiros, arredondamento HALF_UP).
- 🚫 **NUNCA salvar apenas o resultado** — exigir **Memória de Cálculo** auditável em toda rubrica/tributo/convergência.
- 🚫 **NUNCA alterar folha fechada, ponto original ou `audit.logs`** — imutabilidade por triggers no PostgreSQL 17 e versionamento controlado.
- 🚫 **NUNCA apagar regras/tabelas legais históricas** — sempre versionar por vigência (`valid_from`/`valid_to`).
- 🚫 **NUNCA misturar 13º com folha mensal** e **NUNCA tratar FGTS como desconto do empregado**.
- 🚫 **NUNCA expor PII/salários/CID sem autorização** — defesa em profundidade: API (RBAC + Escopo + DTO) **+** PostgreSQL 17 RLS (`SET LOCAL app.current_*` sob role não-superuser `couplerh_app`).
- 🚫 **NUNCA copiar o histórico `.git` legado** para o novo repositório (credenciais antigas expostas em `test_db*.js`).

---

## 📋 Protocolo de Execução para o Agente

1. Ao iniciar o desenvolvimento no novo repositório, execute o **Boot Obrigatório (`/skills/*`)** exigido pelo Project Execution Kernel (`ui-design-system/`, `dashboard-layout/`, `responsive-design/`, `code-maturity-assessor/`).
2. Pegue a **primeira tarefa `[ ]`** da fase atual. Não pule fases nem tarefas, salvo indicação `(paralelizável)`.
3. **Leia integralmente o item correspondente em [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md)** antes de programar. Escreva os **testes TDD do critério de aceite primeiro**, depois a implementação.
4. Um item = um commit limpo (`tipo(escopo): descrição [CÓDIGO]`). Rode `npm run ci` (`lint`, `typecheck`, `test`, `build` e `db-migration-check`) antes e depois; **nunca commite com teste vermelho**.
5. Ao concluir: troque `[ ]` por `[x]`, anote data, commit e resumo; atualize `documentacao.md` e `database.md` (quando houver mudança estrutural no banco).
6. **Dúvida de regra legal, alíquota ou CCT → pare**, marque `[!]` e registre em **"Pendências para Contador / Jurídico / Infraestrutura"** no fim deste arquivo. Não invente regras legais.
7. Toda tabela nova deve nascer com: **RLS habilitada (`ENABLE` + `FORCE`) usando `has_permission()` / `can_access_contract()` + `is_active = TRUE` + gatilho `audit.audit_trigger_func()`**.
8. Só marque uma fase como `[Concluído]` quando **100% dos critérios do Gate** estiverem validados na prática.

---

## 📊 Painel de Progresso — coupleRH v2.0

| Fase | Escopo Principal | Ref. no Blueprint | Status |
|---|---|---|---|
| **V0** | Novo Repositório Git Limpo, Monorepo Open-Source & Baseline PostgreSQL 17 Puro | 📗 Blueprint v2.0 §3 (FASE V0) | `[Concluída]` |
| **V1** | Infraestrutura VPS Oracle Cloud ARM64 (`postgres:17` + Fastify/`pg-boss` + Caddy + Storage HMAC + Backup OCI) | 📗 Blueprint v2.0 §2 e §3 (FASE V1) | `[Concluída]` |
| **V2** | Autenticação Própria Open-Source (Argon2id/JWT/Cookie/MFA `otplib`), Portal Unificado & Blindagem P0 | 📗 Blueprint v2.0 §3 (FASE V2) | `[Concluída]` |
| **V3** | Controle de Perfis Real (RBAC Dinâmico + Escopo Filial/Depto/CC/Equipe + Sigilo Salarial) & API REST Modular | 📗 Blueprint v2.0 §3 (FASE V3) | `[Pendente]` |
| **V4** | Saneamento de Todos os Bugs Críticos do Motor Atual (Férias, 13º, Ponto→Folha, T16, Wizard, Rescisão, Guias) | 📗 Blueprint v2.0 §3 (FASE V4) | `[Pendente]` |
| **V5** | Motor de Folha Enterprise Parte 1 (Worker Lotes/What-If, IRRF Caixa, Pensão Circular ↔ IRRF, Afastamentos, Salário-Família, `indMV`, Estouro `499`/`899`, VT/ANS, CCT) | 📗 Blueprint v2.0 §3 (FASE V5) | `[Pendente]` |
| **V6** | Motor de Folha Enterprise Parte 2 (Médias CCT, Férias/13º+Jan Completos, Rescisão Unificada + Complementar, Dissídio + RRA, Multi-Regime, Patronais) | 📗 Blueprint v2.0 §3 (FASE V6) | `[Pendente]` |
| **V7** | Contabilização Enterprise, Rateios Multi-CC/CNO, Provisões Acumuladas com Baixa, CNAB 240+PIX e Informe | 📗 Blueprint v2.0 §3 (FASE V7) | `[Pendente]` |
| **V8** | Ponto Eletrônico com Geolocalização Enterprise (Anti-Spoofing, Multi-Local, Mapa, PWA Offline, QR Real) & Portal 2.0 + Aprovação do Gestor | 📗 Blueprint v2.0 §3 (FASE V8) | `[Pendente]` |
| **V9** | eSocial Real na VPS Oracle (Cofre A1 AES-256-GCM, XML S-1.2/S-1.3, XML-DSig, mTLS SERPRO e Totalizadores) | 📗 Blueprint v2.0 §3 (FASE V9) | `[Pendente]` |
| **V10** | Notificações Reais, BI & Radar Trabalhista, Admissão Digital, 100+ Golden E2E & Cutover Controlado | 📗 Blueprint v2.0 §3 (FASE V10) | `[Pendente]` |

---

## 🧹 FASE V0: Novo Repositório Git Limpo, Monorepo Open-Source & Baseline PostgreSQL 17 Puro
**Status:** `[Concluída em 22/11/2026]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V0

- [x] **REPO-01** [Concluído em 19/11/2026] Novo repositório limpo criado em `D:\Repositorios\CoupleRHVPS` via `git init -b main` conectado a `https://github.com/cf95souza/CoupleRHVPS.git`; histórico `.git` legado isolado (protegendo credenciais); `.gitignore` estrito configurado; remoção completa de `supabase/`, scripts soltos, `vercel.json` e dependência `@supabase/supabase-js`. (Commit `35e1c67`)
- [x] **REPO-02** [Concluído em 19/11/2026] Monorepo open-source estruturado (`packages/payroll-core` com TypeScript puro, `money.ts` HALF_UP e 16 testes unitários verdes; `apps/api` Fastify 5 + Zod + pg + pool com health check e testes verdes; `apps/web` React 19 + Vite 8 + Tailwind 4 compilando limpo em `dist/` com `apiClient.ts` e `src/config/env.ts` sem hardcodes; `npm run ci` 100% verde). (Commit `85bb834`)
- [x] **REPO-03** [Concluído em 19/11/2026] Runner `apps/api/db/migrate.ts` e baseline 100% PostgreSQL 17 puro `apps/api/db/migrations/0001_baseline_schema.sql` (schema `audit` com trigger imutável, tabelas nativas de segurança `users`, `user_sessions`, `user_mfa_factors`, `auth_tokens`, `stored_files`, funções de sessão `current_app_user_id()`/`current_app_tenant_id()`, todas as 56 tabelas de negócio consolidadas incluindo as 10 antes ausentes, catálogo unificado `benefit_catalogs`, 150 triggers de auditoria e imutabilidade, 46 tabelas com RLS habilitada e role `couplerh_app`) + seeds `apps/api/db/seeds/001_system_and_legal_2026.sql` (vigência 2026, 4 faixas INSS, 5 faixas IRRF, 23 rubricas CLT de sistema e feriados nacionais). Validado com 0 erros no container Docker `postgres:17-alpine`. (Commit `de2b681`)
- [x] **REPO-04** [Concluído em 22/11/2026] Script ETL idempotente `apps/api/db/etl/import_from_legacy.ts` para migração higienizada de dados legados para PostgreSQL 17 puro (mapeando `auth.users` → `public.users` preservando UUIDs, `benefits_catalog` → `benefit_catalogs`, arquivos legados → `stored_files` e documentos) com relatório de reconciliação financeira (divergência R$ 0,00, integridade referencial 100% e 0 registros órfãos), testado e validado no container `postgres:17-alpine` com suite Vitest verde. (Commit `f142033`)
- [x] **REPO-05** [Concluído em 22/11/2026] Configurado `.github/workflows/ci.yml` com 5 gates bloqueadores (Gate 1: Lint, Gate 2: Typecheck, Gate 3: DB Migrations + Seeds 2026 + ETL Dry-Run em container oficial `postgres:17-alpine`, Gate 4: Testes automatizados unitários/integração, Gate 5: Production Build com upload de artefatos). (Commit `4159e3d`)
- [x] **REPO-06** [Concluído em 22/11/2026] Sincronizados `database.md`, `documentacao.md` e `fase.md` do novo repositório `CoupleRHVPS` com a baseline PostgreSQL 17 puro, catalogando as 56 tabelas, arquitetura do monorepo, regras financeiras sem ponto flutuante e governança completa. (Commit `d87684a`)

**Gate V0 (Aprovado):** Repositório nasce com histórico limpo (`0` referências a Supabase/Vercel/segredos), `0001_baseline_schema.sql` sobe em `postgres:17-alpine` vazio com `0` erros e todos os 5 gates do CI passam 100% verdes.

---

## ☁️ FASE V1: Infraestrutura VPS Oracle Cloud Always Free (ARM64) — 100% Open-Source
**Status:** `[Concluído em 23/11/2026]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §2 e §3 FASE V1

- [x] **VPS-01** [Concluído em 23/11/2026] Criado script automatizado de provisionamento e hardening da VPS Oracle Cloud ARM64 `docker/scripts/vps-setup-hardening.sh` (sincronização NTP.br Portaria MTP 671/2021, timezone `America/Sao_Paulo`, firewall UFW blindado 22-rate-limit/80/443, fail2ban anti-bruteforce, unattended-upgrades, sysctl 24 GB RAM e estrutura `/var/lib/couplerh/{pgdata,storage,backups}`) e documentação `docs/VPS_HARDENING_ORACLE.md`. (Commit `8115ea3`)
- [x] **VPS-02** [Concluído em 23/11/2026] Stack `docker/docker-compose.yml` 100% open-source configurada e validada com sucesso (3 containers core: `postgres:17-alpine` tunado para 24 GB RAM com role `couplerh_app` e script `init-user-db.sh`, `couplerh-api` Node 22 Fastify multi-stage `Dockerfile` + `pg-boss`, `caddy:2-alpine` com TLS automático e serving de `dist/` com `no-store` em `index.html`/`version.json`). (Commit `8f0a1df`)
- [x] **VPS-03** [Concluído em 23/11/2026] Implementado `StorageService` e `LocalFsStorageAdapter` (`/var/lib/couplerh/storage`) com blindagem contra Path Traversal, validação estrita de MIME types, cálculo SHA-256 e URLs de download assinadas HMAC-SHA256 (zero bucket público, expiração de 5 min e proteção contra timing attacks com `timingSafeEqual`), rota de stream `GET /api/v1/storage/download/:fileId` e migration `0002_storage_helper.sql` validada com 10/10 testes Vitest verdes. (Commit `55b223c`)
- [x] **VPS-04** [Concluído em 23/11/2026] Configurado `MailerService` (`nodemailer` SMTP TLS com suporte a STARTTLS/SSL) com 5 templates HTML corporativos responsivos em PT-BR e conformidade CLT (boas-vindas/primeiro acesso com CPF mascarado, redefinição de senha com expiração, holerite liberado com link/download PDF, alerta preventivo de prazo concessivo de férias sob Art. 137 CLT e encerramento de espelho de ponto sob Portaria MTP 671/2021) e fila transacional assíncrona `pg-boss` com retentativas automáticas, backoff e fallback direto transparente, validado com 13 testes Vitest verdes. (Commit `1bf2d07`)
- [x] **VPS-05** [Concluído em 23/11/2026] Implementada estratégia de Backup 3-2-1 automatizada (`docker/scripts/backup.sh`: `pg_dump -Fc` do PostgreSQL 17 + compactação do storage `/var/lib/couplerh/storage` + criptografia assimétrica de ponta a ponta ChaCha20-Poly1305 com `age` + manifesto SHA-256 + rotação local 7 dias + sincronização off-site `rclone` para OCI Object Storage Always Free 20 GB), script semanal de simulação de restauração e checagem de sanidade `docker/scripts/restore-drill.sh` (validado em banco temporário com 56 tabelas públicas restauradas e 100% íntegras), instalador de agendamento cron `setup-backup-cron.sh` e guia operacional completo `docs/BACKUP_RESTORE_STRATEGY.md`. (Commit `51e292d`)
- [x] **VPS-06** [Concluído em 23/11/2026] Configurada observabilidade leve de alta performance (< 150 MB RAM total): Pino Logger com sanitização estrita LGPD (censor de senhas, tokens, CPF, PIS, CID-10, salários e contas bancárias), rotação de logs Docker (json-file com limite de 50 MB por contêiner), endpoint `/health` com probes ativas de PostgreSQL e memória, endpoints de métricas de sistema `/api/v1/system/metrics`, migration `0003_system_operational_alerts.sql` e `AlertService` para gestão de incidentes operacionais, contêiner `couplerh-uptime-kuma` integrado ao `docker-compose.yml` e documentação técnica `docs/OBSERVABILITY_MONITORING.md`, 100% validado com 36 testes Vitest no backend e CI verde. (Commit `ad1b1dd`)
- [x] **VPS-07** [Concluído em 23/11/2026] Configurado pipeline de Continuous Deployment (CD) `.github/workflows/deploy-vps.yml` encadeado ao CI com acionamento seguro via SSH, script de deploy automatizado `docker/scripts/deploy.sh` com backup preventivo, migrations transacionais ACID do PostgreSQL 17, swap atômico do frontend `dist/` (zero 404 durante updates), restart gracioso da API Fastify, smoke test automatizado com 10 tentativas contra `/health`, script de rollback de emergência `docker/scripts/rollback.sh` e runbook operacional detalhado `docs/DEPLOY_AND_ROLLBACK_RUNBOOK.md`. (Commit `ad78369`)

**Gate V1 (Aprovado em 23/11/2026):** Stack 100% open-source operando em HTTPS na VPS Oracle ARM64 consumindo `< 2 GB` RAM em idle, `couplerh_app` sujeita a RLS, SMTP validado, Storage privado com URLs HMAC, Backup 3-2-1 e Restore Drill 100% aprovado, CD com zero downtime e rollback garantido.

---

## 🔒 FASE V2: Autenticação Própria Open-Source (RH/Admin vs Portal do Colaborador Prático), MFA TOTP & Blindagem P0
**Status:** `[Concluída em 24/11/2026]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V2 · **BLOQUEADOR DE DADOS REAIS**

- [x] **SEC-01** [Concluído em 23/11/2026] Implementado motor de autenticação nativo Fastify (`apps/api/src/modules/auth/`): hash **Argon2id** (`passwordHasher.ts`), JWT Access Token curto (15 min) com HMAC-SHA256 (`jwtHelper.ts`), Refresh Token rotativo de 7 dias com detecção de replay attack e encerramento remoto de sessões (`tokenService.ts`), cookie `HttpOnly; Secure; SameSite=Lax`, bloqueio anti-brute-force (`max_login_attempts = 5` com lock temporário de 15 min), Rate Limiting Fastify por rota (RFC 6585), rotas corporativas (`/login`) e do portal (`/portal/login` com CPF e Data de Nascimento como senha), migrations `0004_auth_users_flexibility.sql` e `0005_auth_helpers.sql` (funções `SECURITY DEFINER` para resolução pré-RLS e provisioning atômico no portal) e suíte automatizada com 13/13 testes Vitest verdes. (Commit `d6b046e`)
- [x] **SEC-02** [Concluído em 23/11/2026] Implementado **MFA TOTP nativo para RH e Gestão** (`otplib` RFC 6238, secret criptografado com AES-256-GCM via `cryptoHelper.ts`, geração de QR Code SVG, 8 códigos de contingência/recuperação de uso único com hash SHA-256, desafio AAL2 restrito a `require_mfa_roles` administrativos com escopos de token `mfa_setup_only` e `mfa_challenge`), endpoints (`/mfa/enroll`, `/mfa/verify`, `/mfa/challenge`, `/mfa/:id`, `/mfa/factors`, `/session/heartbeat`), hook frontend `useSessionTimeout`, controle real de inatividade de sessão (`session_timeout_minutes`) com revogação e retorno 401 `SESSION_TIMEOUT`, migration `0006_mfa_and_session_helpers.sql` e 17/17 testes Vitest verdes. Isenção total e comprovada de MFA para o Portal do Colaborador mantendo máxima praticidade (CPF + Data de Nascimento). (Commit `85091ec`)
- [x] **SEC-03** [Concluído em 23/11/2026] Implementadas as duas jornadas de acesso unificadas e seguras: 1. **Jornada RH / Gestão / Admin (`/login`)**: E-mail corporativo + Senha forte + MFA TOTP + fluxo completo "Esqueceu a Senha?" (`/forgot-password` com resposta anti-enumeração LGPD, tokens CSPRNG de 32 bytes em `auth_tokens` com expiração de 30 min, verificação `/reset-password/verify` e redefinição `/reset-password` com hash Argon2id e revogação imediata de todas as sessões ativas). 2. **Jornada Portal do Colaborador Prático (`/portal/login`)**: Login direto com CPF + Data de Nascimento como Senha padrão (suporte a `DDMMAAAA` e `DD/MM/AAAA`), fluxo opcional de cadastro/troca de senha própria (`/portal/change-password`) e separação estrita de rotas com bloqueio do papel `employee` no ambiente administrativo (`requireAdminRole` com 403 `FORBIDDEN_EMPLOYEE`). Migration `0007_password_reset_helpers.sql` e suíte com 11/11 testes Vitest verdes. (Commit `5a1d5bf`)
- [x] **SEC-04** [Concluído em 23/11/2026] Implementado middleware transacional PostgreSQL `withTenantContext` e `withReadOnlyTenantContext` (`apps/api/src/shared/db/context.ts`) com escopo estritamente local à transação (`SET LOCAL app.current_user_id / current_tenant_id / current_role_id / current_worker_id`), validação atômica de atividade do usuário, tenant e membership (`public.auth_assert_tenant_context_active` via migration `0008_tenant_context_helpers.sql`), RLS nativa forçada sob a role `couplerh_app`, captura automática de autoria em `audit.logs` pelos triggers existentes, garantia de rollback em falhas, proteção contra poluição do pool de conexões e decorator `request.withContext` integrado ao Fastify. Suíte com 9/9 testes Vitest verdes (totalizando 86 testes na API e 102 no monorepo). (Commit `57fc1f3`)
- [x] **SEC-05** [Concluído em 24/11/2026] Estancadas 100% das brechas P0 da auditoria: 1. Bloqueada escalada de privilégios (`public.update_tenant_user_access` impedindo `dp_analyst` de gerenciar acessos com 403 `FORBIDDEN_PRIVILEGE_ESCALATION`, impedindo `tenant_admin` de promover a `system_admin`, e bloqueando auto-rebaixamento/lockout). 2. Eliminado o bug `NULL NOT IN` e o papel inexistente `dp_manager` em `public.close_payroll_period` e `public.reopen_payroll_period`, com travas CLT (bloqueio de líquido negativo Art. 462, holerites em erro e divergência matemática T6) e trilha imutável `public.payroll_period_reopenings`. 3. Ponto mobile seguro (`public.register_mobile_punch`) com bloqueio IDOR e validação de contrato ativo. 4. Ingestão REP física (`/rep/ingest`) com autenticação via `crypto.timingSafeEqual`, lookup em `time_devices` por serial (`auth_get_rep_device_by_serial`) e mapeamento do trabalhador estritamente por `workers.pis`. 5. Assinatura digital protegida contra IDOR. 6. Autenticação mandatória em todos os endpoints sensíveis (`termination`, `bi`, `documents`, `time-tracking`, `payroll`), mantendo como únicas rotas públicas `/api/v1/public/verify-document/:code` e `/api/v1/public/verify-punch/:code` com mascaramento estrito LGPD. Migration `0009_security_p0_fixes.sql` e 22/22 testes Vitest verdes (totalizando 108 testes na API e 124 no monorepo). (Commit `1d1e483`)
- [x] **SEC-06** [Concluído em 24/11/2026] Implementado cliente HTTP tipado oficial `apps/web/src/lib/apiClient.ts` com gerenciamento de Access Token estritamente em memória (anti-XSS, zero `localStorage`), cookies `HttpOnly; SameSite=Lax; Secure` para Refresh Token, fila de renovação automática em `401 Unauthorized` com mutex anti-race condition (disparo de requisições simultâneas aguarda único refresh sem tempestades concorrentes), suporte integrado a `apiClient.auth` (login, portalLogin, refresh, logout, mfa), expurgo e remoção definitiva de `apps/web/src/lib/supabase.ts` e refatoração limpa de 101 arquivos do frontend, mantendo `vite build` 100% aprovado (`dist/` compilado limpo em 6.40s) e 9/9 testes unitários em `apps/web/tests/apiClient.test.ts` verdes. (Commit `b809937`)
- [x] **SEC-07** [Concluído em 24/11/2026] Executada bateria TDD consolidada de segurança negativa P0 homologando 100% dos requisitos do Gate V2 (`apps/api/tests/gate-v2-negative-security.test.ts` com 14/14 testes verdes): 1. Bloqueio anti-bruteforce (401 na credencial errada e 423 Locked após 5 tentativas consecutivas). 2. Portal do Colaborador (401 em CPF ou Data de Nascimento divergentes; 200 e emissão segura de JWT para credenciais válidas). 3. Detecção e mitigação de Replay Attack em Refresh Token (revogação atômica de todas as sessões ativas do usuário e bloqueio imediato). 4. Bloqueio de acesso administrativo sem MFA AAL2 (403 em tokens com escopo `mfa_challenge`). 5. Bloqueio de escalada de privilégios (`dp_analyst` toma 403, `tenant_admin` não eleva a `system_admin`, e bloqueio de auto-rebaixamento/lockout). 6. Bloqueio IDOR multi-usuário (Colaborador A impedido de bater ponto ou assinar documentos do Colaborador B com 403). 7. Storage Privado com HMAC-SHA256 (400 para parâmetros ausentes e 403 para URLs assinadas adulteradas ou expiradas). 8. Imutabilidade CLT no PostgreSQL 17 (bloqueio atômico de alteração ou inserção de holerites em períodos de folha com status `CLOSED`). 9. Auditoria estática no monorepo atestando 0 ocorrências de `@supabase/supabase-js`. Total acumulado: **147 testes automatizados 100% verdes no monorepo** (`payroll-core`: 16, `api`: 122, `web`: 9). (Commit `bd0931e`)

**Gate V2 (Aprovado em 24/11/2026):** Zero acesso anônimo a PII/holerite/ponto/documentos; portal do colaborador operando perfeitamente com CPF + Data de Nascimento de forma segura no servidor; suíte negativa de segurança prova bloqueio de escalada, IDOR, brute-force e acesso sem MFA para RH quando exigido; 100% dos 14 testes do Gate V2 verdes e 147 testes verdes no monorepo.

---

## 🛡️ FASE V3: Controle de Perfis Real (RBAC Dinâmico + Escopo + Sigilo Salarial) & API REST Modular
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V3

- [x] **RBAC-01** [Concluído em 24/11/2026] Expandido catálogo oficial para 34 permissões granulares categorizadas (`ORGANIZATION`, `COMPENSATION_PAYROLL`, `ACCOUNTING_FISCAL`, `TIME_TRACKING`, `OCCUPATIONAL_HEALTH_SST`, `GOVERNANCE_SYSTEM`), criadas tabelas `permissions`, `roles` (suporte a papéis nativos de sistema e papéis customizados por tenant) e `role_permissions`, adicionada coluna `role_id` em `tenant_users` e removida a check constraint restritiva eliminando enums hardcoded e o bug do `resolveRoleEnum`, criada função SQL `public.has_permission(p_tenant_id, p_slug)` STABLE SECURITY DEFINER com bypass de super_admin e isolamento RLS, implementados middlewares Fastify `requirePermission` e `requireAnyPermission`, endpoints `/api/v1/auth/permissions`, `/catalog` e `/roles`, e validada suíte TDD `tests/rbac-permissions.test.ts` com 14/14 testes verdes (161 testes verdes no monorepo).
- [x] **RBAC-02** [Concluído em 24/11/2026] Implementado Escopo Organizacional Multidimensional (Migration 0011): colunas `manager_worker_id` e `is_confidential_payroll` em `contracts`, `manager_worker_id` em `departments` e `sectors`, `scope_mode` (`ALL`, `RESTRICTED`, `OWN_TEAM`, `SELF_ONLY`) e `worker_id` em `tenant_users`, tabela `tenant_user_scopes` (`COMPANY`, `ESTABLISHMENT`, `DEPARTMENT`, `SECTOR`, `COST_CENTER`, `WORKPLACE`, `TEAM`) com RLS e auditoria imutável, função SQL `public.can_access_contract(p_tenant_id, p_contract_id)` com blindagem de folha confidencial, endpoints `/api/v1/users/accessible-contracts` e `/tenant-access/:id/scopes` (GET/PUT), validado com 8/8 testes TDD verdes (169 testes verdes no monorepo).
- [ ] **RBAC-03** Aplicar políticas RLS nativas PostgreSQL 17 (`ENABLE` + `FORCE ROW LEVEL SECURITY`) em 100% das tabelas críticas combinando `has_permission()`, `can_access_contract()` e `is_active = TRUE` + `append-only` em `audit.logs`, `time_punch_records`, `signatures_log` e `document_events`
- [ ] **RBAC-04** Implementar **Sigilo Salarial, Folha Confidencial (Diretoria) e Mascaramento LGPD Real**: flag `is_confidential_payroll` em contratos; serializers/DTOs no servidor e views SQL suprimindo `base_salary`/reajustes/holerites sem `view_salaries` (e diretoria sem `view_executive_payroll`), mascarando CPF/PIS/PIX sem `view_pii_unmasked` e ocultando CID-10 sem `view_medical_cid`
- [ ] **RBAC-05** Construir módulos REST validados com Zod em `apps/api/src/modules/*` (`org`, `employees`, `vacations`, `leaves`, `benefits`, `loans`, `payroll`, `time-tracking`, `documents`, `sst`, `esocial`, `settings`, `audit`, `portal`, `public-verify`) e migrar todos os 95 arquivos do frontend para `apiClient` (zero SQL saindo do browser!)
- [ ] **RBAC-06** Blindar 100% da interface: `AuthContext` hidratado via `/api/v1/auth/me`, `CompanyContext` filtrado pelo escopo, `<RequirePermission>` em todas as 50+ rotas (remover rota duplicada `/cargos`), página `403 Acesso Restrito`, `DashboardLayout` filtrando `NAV_SECTIONS` e ocultando seções vazias, e `<Can permission="...">` em abas/botões/campos sensíveis
- [ ] **RBAC-07** Reconstruir tela de Perfis e Acessos (`/configuracoes`): matriz interativa de permissões por módulo, criação/clonagem de perfis customizados, editor de escopo organizacional e painel de sessões ativas com revogação remota
- [ ] **RBAC-08** Suíte automatizada de Matriz de Isolamento (2 tenants × 8 papéis padrão + 2 perfis customizados validando API + PostgreSQL 17 RLS + UI)

**Gate V3:** Cada usuário só vê no menu, nas rotas, nas telas, na API e no PostgreSQL 17 **estritamente** os módulos, empresas, setores/equipes e dados salariais/médicos permitidos ao seu perfil; zero `@supabase/supabase-js` no projeto.

---

## 🔧 FASE V4: Saneamento de Todos os Bugs Críticos do Motor Atual
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V4

- [ ] **BUG-01** Corrigir `ReferenceError: fixedEventsByContract` na folha `VACATION` + fluxo do `Vacations/Wizard.tsx` (`status: 'DRAFT'` + aprovação + `toast.success` em Férias e Offboarding)
- [ ] **BUG-02** Corrigir `TypeError: sumMoney` → `addMoney` na consolidação T16 de INSS
- [ ] **BUG-03** Incluir rubrica `903` na `THIRTEENTH_1` (fim do erro 422) + corrigir duplo FGTS na `THIRTEENTH_2` (FGTS diferencial exato sem tributar 2x a 1ª parcela)
- [ ] **BUG-04** Corrigir integração Ponto → Folha e Eventos Variáveis por quantidade (`amount: null` vs `0` no banco e no `PayrollEngine` para não zerar HE, Noturno, Faltas e Atrasos)
- [ ] **BUG-05** Unificar catálogo de variáveis em `packages/payroll-core/src/variablesCatalog.ts` (PT-BR único entre `PayrollContext`, `rubricWizardService` e API)
- [ ] **BUG-06** Eliminar hardcodes `5000`/`7350` no `IRRFCalculator` (100% guiado por vigência em `general_legal_parameters`), remover fallbacks `1621.0`, corrigir 1/3 (`33.3333` → `divideMoney(val, 3)`) e clamping `>= 0` nas bases legais
- [ ] **BUG-07** Remover códigos hardcoded conflitantes (`101`/`150`/`806`) e regex numérica no `DAGResolver`; propagar `integra_dsr`/`irrf_mode`/`media_*`; corrigir `BASE_HORA_EXTRA` (salário integral Súmula 264 TST + separação de `BASE_HORA_EXTRA_NOTURNA`)
- [ ] **BUG-08** Corrigir bugs imediatos da rescisão (dupla dedução INSS no IRRF, projeção Dez→Jan e > 1 avo, dependentes e datas sem `toISOString()`)
- [ ] **BUG-09** Corrigir bugs satélites: `fetchPeriodTaxGuides` (selecionar `id` de `payslips` corrigindo guias zeradas), pré-folha (`leaves` + filtro `company_id`), backup (`lgpd_data_sharing_registry`), `Payslips.tsx` (filtro empresa), `save_payroll_period` (`legal_version_id`, `rubric_version_id` e incremento `payslips.version`) e FGTS 2% aprendiz real na agregação patronal
- [ ] **BUG-10** Filtrar `holidays` por `tenant_id` + âmbito (Nacional/UF/Município IBGE da lotação), respeitar `total_limit` em deduções percentuais e eliminar qualquer truncamento de 1.000 linhas via `pg` direto

**Gate V4:** Férias, 13º (1ª e 2ª), Ponto→Folha, Consolidação INSS T16, Wizard de Rubricas, Rescisão e Guias Tributárias passando 100% em testes de integração E2E sobre PostgreSQL 17.

---

## ⚙️ FASE V5: Motor de Cálculo Enterprise — Parte 1 (Padrão Apdata / TOTVS / ADP)
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V5

- [ ] **FOLHA-01** **Worker Assíncrono em Lotes (`payroll_calculation_jobs` + `pg-boss`) + Simulação *What-If* em Lote:** chunks de 50 contratos, progresso em tempo real, watchdog anti-deadlock `CALCULATING` e simulador de reajustes/cenários sem tocar em `payslips`
- [ ] **FOLHA-02** **IRRF em Regime de Caixa (Lei 7.713/88 / IN RFB 1.500):** `payment_date` em `payroll_periods`, ledger `irrf_cash_ledger`, consolidação mensal por data de pagamento (5º dia útil + adiantamento/complementar), buckets exclusivos (Férias, 13º, PLR, RRA) e memória detalhada
- [ ] **FOLHA-03** **Pensão Alimentícia Enterprise (Solver Circular Pensão ↔ IRRF + Multi-Beneficiário):** tabela `alimony_beneficiaries`, algoritmo iterativo de ponto fixo (tolerância R\$ 0,01) para pensão sobre líquido (`Bruto - INSS - IRRF`) com trace na memória, múltiplos beneficiários com dados bancários/PIX e `payslip_alimony_splits`
- [ ] **FOLHA-04** **Integração Completa de Afastamentos (`leaves` — Tabela 18 eSocial):** `LeaveImpactCalculator` cobrindo Auxílio-Doença (15d empresa + soma atestados mesma CID em 60d + INSS a partir 16º dia), Acidente de Trabalho (**FGTS mantido obrigatório** + estabilidade 12m), Licença-Maternidade (120/180d + **dedução automática DCTFWeb**), Serviço Militar (FGTS mantido), licença sem vencimentos, reflexo em 13º e perda de aquisitivo de férias (>180d — CLT art. 133 IV)
- [ ] **FOLHA-05** **Salário-Família Automático + Dedução DCTFWeb:** `FamilyAllowanceCalculator` sobre remuneração bruta INSS ≤ teto, filhos ≤ 14 anos ou inválidos, vacina/escola, proporcionalidade na admissão/demissão, rubrica `305` e abatimento automático na DCTFWeb
- [ ] **FOLHA-06** **Múltiplos Vínculos (INSS Outro Empregador — `indMV` 1/2/3):** tabela `employee_other_employments` + consolidação de múltiplas matrículas do mesmo CPF no grupo econômico até o teto previdenciário
- [ ] **FOLHA-07** **Fila de Prioridade Legal de Descontos, Margem Consignável 35% e Insuficiência de Saldo (`499`/`899`):** `discount_priority` nas rubricas, trava 35% + baixa automática de parcelas de `employee_loans`, política de estouro gerando `499` (provento neutro) + agendamento automático `899` na competência seguinte
- [ ] **FOLHA-08** **Benefícios Enterprise:** teto legal VT (`MIN(6% salário proporcional, valor efetivo concedido)` — Lei 7.418/85), proporcionalidade em férias/faltas/home-office, Plano de Saúde/Odonto por titular + dependentes + código ANS e importação CSV de coparticipação
- [ ] **FOLHA-09** **Sindicatos e Convenções Coletivas (CCT):** tabelas `unions` e `collective_agreements` (data-base, piso, % HE escalonada, %/horário noturno, base insalubridade por CCT, ATS anuênio/triênio/quinquênio, regras de médias e estabilidade pós-férias) integradas ao motor

**Gate V5:** Suíte TDD + casos dourados conferidos pelo contador provando IRRF Caixa, convergência exata Pensão ↔ IRRF, afastamentos com FGTS/maternidade, Salário-Família, `indMV`, estouro `499`/`899`, teto VT e CCT.

---

## 🧮 FASE V6: Motor de Cálculo Enterprise — Parte 2 (Médias, Férias, 13º, Rescisão, Dissídio e Multi-Regime)
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V6

- [ ] **FOLHA-10** **Motor de Médias Configurável por CCT (`AveragesCalculator`):** janelas configuráveis (aquisitivo, 12m, 6m, melhor média), quantidade de horas valorizada pelo salário atual (Súmula 347 TST) vs valor monetário atualizado + reflexo DSR com memória mês a mês alimentando Férias, 13º e Rescisão
- [ ] **FOLHA-11** **Férias Enterprise:** redução automática por faltas no aquisitivo (CLT art. 130), validação fracionamento (14+5+5 e vedação 2d antes feriado/DSR), férias em dobro (CLT art. 137 isenta de encargos), férias partidas entre meses (rateio INSS/FGTS por competência vs IRRF caixa), férias coletivas em lote (CLT arts. 139–140) e médias automáticas
- [ ] **FOLHA-12** **13º Salário Enterprise:** avos com faltas/afastamentos, médias automáticas, tributação exclusiva, FGTS diferencial sem duplicidade, pensão sobre 13º, 13º maternidade dedutível e **13º Complementar em Janeiro** (Decreto 10.854/2021 art. 79)
- [ ] **FOLHA-13** **Motor de Rescisão Unificado ao `PayrollEngine` + Rescisão Complementar:** TRCT gerado pelo motor oficial com memória auditável cobrindo todos os motivos CLT/eSocial, aviso Lei 12.506/2011 (trabalhado/indenizado/misto NT 184/2012), férias vencidas/dobro/proporcionais via `vacation_vesting_periods`, médias automáticas, Art. 9º trintídio data-base, quitação banco de horas como HE, teto Art. 477 §5º, multa FGTS sobre saldo real e **Rescisão Complementar**
- [ ] **FOLHA-14** **Folha Complementar e Dissídio Coletivo Retroativo Multi-Competência + RRA:** recálculo diferencial mês a mês desde a data-base (reflexos em HE/DSR/Férias/13º, INSS/FGTS por competência de origem e IRRF Caixa ou **RRA Art. 12-A** para anos anteriores) com breakdown para `ideADC` do eSocial
- [ ] **FOLHA-15** **Categorias Especiais de Vínculos (Multi-Regime eSocial):** Pró-Labore (11% fixo até teto, sem FGTS, 20% patronal sem RAT/Terceiros), Autônomo/RPA (11%, base reduzida transporte 20%/60%, SEST/SENAT, ISS), Estagiário (Lei 11.788 + recesso remunerado), Intermitente (Art. 452-A + alerta complementação INSS) e Horista/Comissionista Puro (DSR separado + garantia mínima)
- [ ] **FOLHA-16** **Encargos Patronais Avançados:** CPRB proporcional (receita mista) + reoneração gradual Lei 14.973/2024, RAT adicional aposentadoria especial (6%/9%/12%), deduções Salário-Família/Maternidade na DCTFWeb e eliminação total de encargos calculados no frontend

**Gate V6:** Motor cobre todo o espectro trabalhista brasileiro com 0 divergência contra planilhas oficiais de validação contábil.

---

## 📊 FASE V7: Contabilização Enterprise, Rateios, Provisões Reais, Bancos e Obrigações
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V7

- [ ] **CONT-01** **Rateio Multi-CC, Projetos, Tomadores (Lei 9.711/98) e Obras CNO (S-1020):** `contract_cost_allocations` (soma 100%) e `payslip_cost_allocations` rateando proventos, encargos e provisões sem perda de centavos
- [ ] **CONT-02** **Provisões Contábeis Reais Acumuladas com Baixa Mensal:** `accounting_provisions_ledger` (saldo anterior + avo mensal + reajuste/médias − baixas reais de férias/13º/rescisão = lançamento líquido contábil do mês)
- [ ] **CONT-03** **Motor Contábil Parametrizável + Exportadores ERP:** plano de contas editável (`accounting_chart_of_accounts` / `accounting_mapping_rules`), partidas dobradas `D === C` e exportação nos leiautes **Domínio, Alterdata, TOTVS Protheus, Senior e CSV configurável**
- [ ] **CONT-04** **CNAB 240 Completo (Bancos + PIX/TED + Pensão + Retorno):** Segmentos A e B no backend, leiautes multi-banco, pagamento separado dos pensionistas (`payslip_alimony_splits`) e importador de `.ret` conciliando liquidação bancária
- [ ] **CONT-05** **Informe de Rendimentos Completo (Quadros 1–7 RFB) & Painel de Conciliação DCTFWeb / FGTS Digital:** incluindo pensão por beneficiário/CPF, previdência privada, plano de saúde por titular/dependente/ANS, RRA e PLR

**Gate V7:** Contabilidade fecha `D === C`, provisão acumulada bate com passivo real, CNAB 240 valida em homologador bancário e Informe de Rendimentos confere integralmente.

---

## 📍 FASE V8: Ponto Eletrônico com Geolocalização Enterprise & Portal do Colaborador 2.0
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V8

- [ ] **PONTO-01** **Endpoint Único `/api/v1/time-tracking/punch` + Anti-Spoofing GPS:** JWT + ownership + contrato `ACTIVE`, debounce 60s, IP real via Caddy, `receipt_code` exclusivo server-side, validação de `accuracy_meters` máxima, detecção de `accuracy === 0` e teletransporte/velocidade impossível (`fraud_flags`)
- [ ] **PONTO-02** **Múltiplos Locais Permitidos (`contract_allowed_workplaces`) + Mapa/Auditoria GPS no RH:** autorizar 1..N locais ou externo auditável + exibição na `TimeManagement.tsx` de status geofence, distância, precisão e modal de mapa (Leaflet/OpenStreetMap gratuito) com raio vs ponto da batida
- [ ] **PONTO-03** **PWA Real + Modo Offline Resiliente para Ponto Mobile:** `vite-plugin-pwa`, ícones PNG 192/512, Service Worker e fila IndexedDB sincronizando ao reconectar gravando `sync_origin = 'OFFLINE_PWA'`, `device_timestamp` e `server_received_at` separados
- [ ] **PONTO-04** **Comprovante REP-P com QR Code Real + `/verificar-ponto` + Selfie Opcional LGPD:** QR Code verdadeiro (`qrcode`) sem CPF na URL, página pública `/verificar-ponto/:codigo`, e captura opcional de selfie condicionada a consentimento ativo em `lgpd_consents` (storage privado)
- [ ] **PONTO-05** **Portal do Colaborador 2.0 (Correções + Escala Visual + Anexo de Atestado):** padronizar rótulos `entry_type` PT-BR, migrar `TimeBankModal` e `TimesheetViewModal` para API autenticada multi-mês, corrigir `get_my_lgpd_dossier` (`positions.title` / `base_salary`), renderizar aba Benefícios e âncora Férias, adicionar **Calendário Visual da Escala/Turno** e **Justificativa com Upload de Atestado Médico** (storage privado)
- [ ] **PONTO-06** **Workflow Multinível de Aprovação pelo Gestor do Setor (`/aprovacoes`):** fila filtrada por `can_access_contract` para o Gestor aprovar/indeferir ajustes de ponto, atestados (com CID oculto!), folgas de banco de horas e férias da própria equipe (`PENDING_MANAGER → APPROVED_MANAGER → APPROVED_DP`)
- [ ] **PONTO-07** **Regras Avançadas de Jornada:** HE noturna composta (OJ 97 SDI-1 TST), sobreaviso (1/3), prontidão (2/3), escalas rotativas/revezamento e banco de horas negativo parametrizado por CCT

**Gate V8:** Colaborador bate ponto com GPS anti-spoofing (online ou offline PWA), recebe comprovante com QR Code verificável, vê sua escala e envia atestado; Gestor aprova apenas sua equipe; RH audita batidas no mapa.

---

## 🌐 FASE V9: eSocial Real na VPS Oracle Cloud (A1 ICP-Brasil + mTLS + Totalizadores)
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V9

- [ ] **ESOC-01** **Cofre Criptografado do Certificado Digital A1 (`.pfx`):** upload real + parse X.509 real (CNPJ/titular/emissor/serial/validade) + criptografia envelope AES-256-GCM (`CERTIFICATE_MASTER_KEY` fora do banco) + alertas de vencimento (60/30/15/7d)
- [ ] **ESOC-02** **Gerador XML Layouts S-1.2 / S-1.3 + Validador XSD:** eventos de tabela (`S-1000`, `S-1005`, `S-1010`, `S-1020`), não periódicos (`S-2190`, `S-2200`, `S-2205`, `S-2206`, `S-2230`, `S-2240`, `S-2299`, `S-2300`, `S-2399`) e periódicos (`S-1200`, `S-1210`, `S-1298`, `S-1299`)
- [ ] **ESOC-03** **Assinatura XML-DSig (RSA-SHA256) + Transmissor mTLS Assíncrono (SERPRO/Gov.br):** assinatura nativa no Worker Node.js + HTTPS mTLS com A1 + fila `pg-boss` com retry exponencial + polling automático salvando recibos oficiais
- [ ] **ESOC-04** **Processamento dos Eventos Totalizadores (`S-5001`, `S-5002`, `S-5003`, `S-5011`, `S-5012`, `S-5013`):** painel de confronto automático **CoupleRH × Governo** destacando divergências antes do fechamento DCTFWeb/FGTS Digital
- [ ] **ESOC-05** **Homologação Oficial em Produção Restrita (eSocial):** 1 ciclo completo transmitido e aceito com recibos reais antes de habilitar chave de Produção

**Gate V9:** Ciclo completo aceito em Produção Restrita com recibos oficiais e confronto `S-5001/S-5002/S-5003` batendo R\$ 0,00 contra o motor.

---

## 🏆 FASE V10: Excelência Operacional, BI, Admissão Digital, 100+ Golden E2E & Cutover
**Status:** `[Pendente]` · **Ref.:** [`DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md`](./DOCUMENTO_ANALISE_ENTERPRISE_VPS_COUPLERH.md) → §3 FASE V10

- [ ] **ENT-01** **Motor Real de Notificações & Cron (`pg-boss`):** disparo real de alertas `CONF-04` (e-mail SMTP + WhatsApp opcional + sininho in-app clicável) para férias/dobra, ASO, banco de horas, fechamento do ponto, A1 vencendo e falhas operacionais
- [ ] **ENT-02** **BI Executivo & Radar de Risco Trabalhista:** `/dashboard` respeitando escopo RBAC com custo real empresa, massa salarial 12m, HE vs banco, turnover, absenteísmo e Radar de Passivo (dobra de férias, interjornada < 11h, intrajornada, HE > 2h/dia)
- [ ] **ENT-03** **Admissão Digital Self-Service:** link seguro temporário para pré-admissão, envio de documentos no storage privado e assinatura eletrônica de contrato, VT, banco de horas e ciência LGPD
- [ ] **ENT-04** **Suíte Golden Enterprise (100+ Cenários E2E contra API + PostgreSQL 17) + Benchmark na VPS (1.000 e 5.000 contratos)**
- [ ] **ENT-05** **Cutover Controlado (Legado → VPS Oracle PostgreSQL 17 Puro):** congelamento pós-fechamento, ETL (`REPO-04`) com reconciliação R\$ 0,00, 1–2 competências paralelas conferidas pelo contador, virada de DNS, monitoramento 30 dias e desligamento seguro do ambiente legado

**Gate V10:** 100% da operação rodando na VPS Oracle Cloud Free Tier (PostgreSQL 17 puro, 100% open-source) com estabilidade, zero divergência contábil, backup 3-2-1 validado e governança enterprise completa.

---

## 📋 Pendências para Contador / Jurídico / Infraestrutura (v2.0)

- [ ] **Segurança Imediata:** Rotacionar a senha da conta administrativa exposta nos scripts `test_db*.js` do repositório legado
- [ ] **Infraestrutura:** Definir domínio/subdomínios (`app.<dominio>` e `api.<dominio>`), provedor SMTP transacional (SES/Brevo/Resend/Postmark) e confirmar capacidade/região da VPS Oracle Cloud Always Free (ARM64 4 OCPU / 24 GB RAM)
- [ ] **Contador — Regime de Caixa IRRF:** Confirmar política de pagamento de salário da empresa (5º dia útil vs último dia do mês) e regra de retenção de IRRF no adiantamento
- [ ] **Contador — CCT & Médias:** Fornecer convenção coletiva vigente da empresa (data-base, pisos, % HE, noturno, base de insalubridade, regra de médias de férias/13º e banco de horas)
- [ ] **Contador — Plano de Contas & ERP:** Informar o software contábil utilizado pela contabilidade (Domínio, Alterdata, Protheus, Senior ou layout próprio) para priorizar o exportador `CONT-03`
- [ ] **Jurídico — Ponto Mobile & Selfie:** Validar política de geofencing restritivo vs auditoria, tolerância de precisão GPS e eventual uso de selfie com consentimento LGPD
- [ ] **Jurídico/Fiscal — Certificado A1:** Disponibilizar certificado A1 (`.pfx`) para homologação em Produção Restrita do eSocial na Fase V9
