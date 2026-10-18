# CoupleRH: Guia Operacional de Ambientes, CI/CD e Homologação (Fase P9)

Este documento especifica a governança de ambientes, esteiras de integração contínua (CI/CD) e procedimentos de implantação do sistema **coupleRH**, garantindo conformidade rigorosa com a legislação trabalhista CLT e os critérios de qualidade do `DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md` (§10).

---

## 1. Matriz de Ambientes

| Ambiente | Branch Git | Domínio / URL | Projeto Supabase | Finalidade |
|---|---|---|---|---|
| **Desenvolvimento (`dev`)** | `develop` / `feature/*` | `http://localhost:5173` | Local (`npx supabase start`) ou sandbox | Desenvolvimento ágil, TDD e novos recursos. |
| **Homologação (`staging`)** | `staging` | `https://staging-couplerh.vercel.app` | Projeto Staging dedicado | Validação de folha paralela, testes de integração e homologação pelo contador. |
| **Produção (`production`)** | `main` | `https://couplerh.vercel.app` (e domínio próprio) | `wcvgpnmaryumfcfwyrrj` | Operação oficial, geração de holerites válidos e transmissões eSocial. |

---

## 2. Variáveis de Ambiente por Estágio

### 2.1 Arquivo `.env.example` (Padrão para Dev e Staging)
```bash
# Conexão Supabase
VITE_SUPABASE_URL=https://<seu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-public-key>

# Ambiente Operacional do eSocial ('producao' ou 'restrita')
VITE_ESOCIAL_ENVIRONMENT=restrita

# Versão do Sistema
VITE_APP_VERSION=1.0.0-rc
```

### 2.2 Produção (`.env.production`)
- `VITE_SUPABASE_URL`: URL oficial do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Chave anônima pública do projeto de produção.
- `VITE_ESOCIAL_ENVIRONMENT`: `producao` (ou configurável via painel de configurações).
- **Proibição Absoluta:** Jamais incluir a `service_role` key em qualquer arquivo de ambiente frontend!

---

## 3. Pipeline de Integração Contínua (CI)

O fluxo do GitHub Actions (`.github/workflows/ci.yml`) é acionado automaticamente em cada `push` e `pull_request` nas branches `main`, `staging` e `develop`.

A esteira executa sequencialmente 4 portões de qualidade bloqueadores:
1. **Lint Analysis:** `npm run lint` (`oxlint src`) — valida sintaxe, regras de React Hooks e boas práticas sem erros.
2. **Type Checking:** `npm run typecheck` (`tsc --noEmit`) — validação estrita de tipos com TypeScript e `"verbatimModuleSyntax": true`.
3. **Automated Test Suite:** `npm test` (`vitest run`) — execução de 100% dos testes unitários e de integração (motores de cálculo, tabelas legais, isolamento multitenant, auditoria T29 e configurações globais).
4. **Production Build:** `npm run build` (`vite build`) — compilação do bundle de produção verificando ausência de quebras no empacotamento.

> **Regra de Ouro:** Nenhum código pode ser integrado à branch `main` ou promovido para homologação se qualquer etapa do CI falhar (teste vermelho ou erro de tipo).

---

## 4. Política de Promoção de Banco de Dados e Migrations

1. **Numeração Sequencial Estrita:**
   - Novas migrations devem seguir a sequência oficial em `supabase/migrations/` (ex: `00108_...`, `00109_...`).
2. **Imutabilidade e RLS:**
   - Toda nova tabela deve obrigatoriamente possuir:
     - RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
     - Política estrita baseada em `tenant_id = ANY(public.user_tenant_ids())`.
     - Gatilho forense de auditoria T29 anexado (`audit.audit_trigger_func()`).
3. **Comando de Promoção:**
   - Em homologação: `npx supabase db push --db-url <DATABASE_URL_STAGING>`
   - Em produção: `npx supabase db push --db-url <DATABASE_URL_PRODUCTION>`

---

## 5. Procedimentos de Rollback e Contingência

Em caso de inconsistência detectada durante homologação ou pós-deploy:
1. **Frontend:** Reverter o commit ou fazer rollback de deployment no painel da Vercel para a versão anterior em $< 2$ minutos.
2. **Banco de Dados:**
   - Toda migration deve conter scripts compensatórios ou utilizar o backup contínuo com PITR (Point-In-Time Recovery) documentado em [docs/disaster_recovery_runbook.md](file:///d:/Repositorios/coupleRH/docs/disaster_recovery_runbook.md).
   - O RPO garantido é $\le 5$ minutos e o RTO é $\le 60$ minutos.
