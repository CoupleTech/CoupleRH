Diagnóstico e Correção do Motor de Cálculo da Folha — coupleRH
Contexto
O motor de cálculo da folha (payroll-engine Edge Function) não está funcionando corretamente. Após análise profunda de todos os arquivos envolvidos — incluindo a tela de Rubricas conforme solicitado — identifiquei 18 bugs que impedem o sistema de funcionar.

🔴 SEÇÃO A — BUGS NA TELA DE RUBRICAS (A tela NÃO funciona!)
BUG R1 — Nomes de colunas INCOMPATÍVEIS entre a tela e o banco de dados (CRÍTICO!)
Arquivo: 
Rubrics.tsx
Problema: A tela Rubrics.tsx grava e lê colunas que têm nomes diferentes dos que existem no banco.
O que a tela envia (payload)	O que existe no banco (migration 00023)	Resultado
incidence_inss_patronal	inss_patronal_incidence	❌ Ignorado silenciosamente
incidence_rat	rat_incidence	❌ Ignorado silenciosamente
incidence_third_parties	terceiros_incidence	❌ Ignorado silenciosamente
generates_base_inss	generates_inss_base	❌ Ignorado silenciosamente
generates_base_irrf	generates_irrf_base	❌ Ignorado silenciosamente
generates_base_fgts	generates_fgts_base	❌ Ignorado silenciosamente
valid_from	Não existe na tabela	❌ Ignorado
valid_to	Não existe na tabela	❌ Ignorado
version	Não existe na tabela	❌ Ignorado
esocial_description	Não existe (só tem esocial_code e esocial_nature_code)	❌ Ignorado
Impacto: Quando o usuário configura incidências e bases na tela de Rubricas e clica "Salvar", as configurações são silenciosamente descartadas pelo Supabase (que ignora colunas desconhecidas em INSERT/UPDATE). As rubricas ficam salvas mas sem as flags de incidência e base corretas. O motor depois lê os valores como false e calcula tudo errado.
BUG R2 — A tela lê generates_base_inss mas o motor lê generates_inss_base
Arquivo: 
Rubrics.tsx
 vs 
index.ts
Problema: Dupla inconsistência:
A tela tenta gravar generates_base_inss (não existe)
O motor lê r.generates_inss_base (que existe mas está false porque a tela nunca conseguiu setar)
O fallback r.incidence_inss || r.generates_inss_base mascara parcialmente, mas fica conceitualmente errado (incidência ≠ gera base)
Impacto: Bases de INSS/IRRF/FGTS não são construídas corretamente.
BUG R3 — calculation_form vs calculation_type — duas colunas com propósitos sobrepostos
Arquivo: 
Rubrics.tsx
 vs 
index.ts
Problema:
A migração 00020 cria calculation_type com valores: FIXED, FORMULA, PERCENTAGE_OF_BASE, REFERENCE_TABLE
A migração 00023 adiciona calculation_form com valores: FIXO, PERCENTUAL, DIAS, HORAS, FORMULA, MANUAL, AUTOMATICA
A tela grava em calculation_type (valores em inglês: FIXED, HOURS, DAYS)
O motor lê r.calculation_form || r.calculation_type (fallback) — mas os valores são diferentes!
calculation_type = 'HOURS' na tela ≠ calculation_form = 'HORAS' no motor
Impacto: Rubricas configuradas como "Por Horas" ou "Por Dias" na tela não são interpretadas corretamente pelo motor.
BUG R4 — calculation_base não aparece para FIXED na tela
Arquivo: 
Rubrics.tsx
Problema: Os campos de calculation_base, percentage, divisor só aparecem quando calculationType é PERCENTAGE_OF_BASE, HOURS ou DAYS. Mas para o Salário Base (que é FIXED), o motor precisa saber que calculation_base = 'SALARIO_BASE'. Como a tela não mostra o campo, o usuário não pode configurar isso.
Impacto: Rubricas fixas que deveriam ter base de cálculo ficam sem, e o motor não sabe calcular.
BUG R5 — Falta campo factor no payload de salvamento
Arquivo: 
Rubrics.tsx
Problema: A variável de estado factor não existe na tela. O campo factor (usado para HE: 1.5 para 50%, 2.0 para 100%) nunca é salvo.
Impacto: Horas extras sempre usam o fallback factor = 1.5 independente da configuração.
BUG R6 — Falta coluna origin na tabela payroll_rubrics
Arquivo: 
Rubrics.tsx
Problema: A tela envia origin: 'MANUAL'/'AUTOMATICA'/etc mas a migração 00020 original não criou essa coluna. A 00023 também não a adiciona. O Supabase ignora a coluna silenciosamente.
Impacto: Não há como diferenciar rubricas manuais de automáticas no banco.
🔴 SEÇÃO B — BUGS NO MOTOR DE CÁLCULO (Edge Function)
BUG 1 — Código do Salário Base inconsistente
Arquivo: 
index.ts
Problema: Procura código '101' mas rubricas manuais podem ter '1001'.
Impacto: Salário Base não é injetado → proventos zerados.
BUG 2 — manual_value sobrepõe cálculo automático de faltas/atrasos
Arquivo: 
PayrollEngine.ts
Problema: Se manual_value > 0, usa como valor final. Para faltas, o espelho de ponto envia amount (valor monetário pré-calculado) quando deveria enviar quantity (dias).
Impacto: Descontos de faltas calculados incorretamente.
BUG 3 — Descontos SOMAM nas bases ao invés de subtrair
Arquivo: 
PayrollEngine.ts
Problema: this.context.base_inss += valorCalculado quando rubrica é DEDUCTION deveria subtrair.
Impacto: Bases infladas → impostos maiores que deveriam.
BUG 5 — Dependentes NUNCA são carregados do banco
Arquivo: 
index.ts
Problema: Nenhuma query busca employee_dependents. getVariable('DEPENDENTES') sempre retorna 0.
Impacto: IRRF sempre sem dedução de dependentes.
BUG 7 — INSS/IRRF/FGTS buscam rubrica por código errado
Arquivo: 
PayrollEngine.ts
Problema: Busca 'INSS_AUTO' mas a rubrica tem código '901'.
Impacto: INSS/IRRF/FGTS podem não aparecer no holerite.
BUG 8 — Filtro rubric_id.includes('-') rejeita IDs legítimos
Arquivo: 
index.ts
Problema: Testa se rubric_id contém - para "validar UUID". 'INSS_AUTO' não contém e é excluído.
Impacto: Itens tributários não salvos nos payslip_items.
BUG 11 — Sem validação de líquido negativo
Impacto: Holerites com valor negativo são gerados e salvos sem alerta.
BUG 12 — const rubricAdvEarning reatribuída (crash!)
Arquivo: 
index.ts
Problema: const não pode ser reatribuída.
Impacto: Toda folha de ADIANTAMENTO crasha se rubrica 301 não existe.
📋 Proposta de Correção (Ordem de Prioridade)
Etapa 1 — Alinhar schema do banco com a tela de Rubricas
[NEW] 
00048_fix_rubrics_schema.sql
Adicionar/renomear colunas faltantes na tabela payroll_rubrics:

sql

-- Adiciona colunas que a tela Rubrics.tsx espera mas não existem
ALTER TABLE payroll_rubrics 
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS esocial_description TEXT;
-- Cria aliases ou renomeia para compatibilidade
-- Opção: Adicionar colunas com os nomes que a tela usa
ALTER TABLE payroll_rubrics 
  ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN DEFAULT false;
-- Migrar dados existentes das colunas antigas para as novas
UPDATE payroll_rubrics SET 
  incidence_inss_patronal = COALESCE(inss_patronal_incidence, false),
  incidence_rat = COALESCE(rat_incidence, false),
  incidence_third_parties = COALESCE(terceiros_incidence, false),
  generates_base_inss = COALESCE(generates_inss_base, false),
  generates_base_irrf = COALESCE(generates_irrf_base, false),
  generates_base_fgts = COALESCE(generates_fgts_base, false);
Etapa 2 — Corrigir o Motor (PayrollEngine + index.ts)
[MODIFY] 
index.ts
Corrigir const → let na linha 270 (BUG 12)
Adicionar query de dependentes (BUG 5)
Ajustar leitura de incidências para aceitar ambos os nomes de colunas (compat)
Corrigir filtro UUID em payslip_items (BUG 8)
Buscar rubrica de salário por '101' OU '1001' (BUG 1)
[MODIFY] 
PayrollEngine.ts
Subtrair bases quando rubrica é DEDUCTION (BUG 3)
Buscar rubricas legais por código '901'/'902'/'903' (BUG 7)
Aceitar calculation_type com valores em inglês: HOURS→HORAS, DAYS→DIAS, etc. (BUG R3)
Validar líquido negativo (BUG 11)
Etapa 3 — Corrigir a Tela de Rubricas
[MODIFY] 
Rubrics.tsx
Mostrar campo calculation_base para todos os tipos (não só para HOURS/DAYS/PERCENTAGE) (BUG R4)
Adicionar campo factor ao formulário e ao payload (BUG R5)
Garantir que os valores salvos em calculation_type sejam os mesmos que o motor lê (BUG R3)
Etapa 4 — Seed de Rubricas Padrão Corrigido
[NEW] 
00049_fix_rubrics_and_codes.sql
Limpar rubricas duplicadas (1001 vs 101, 2001 vs 901)
Criar rubricas 150 (HE50) e 160 (HE100) para o Espelho de Ponto (BUG 10)
Garantir que todos os seeds usem as colunas com nomes corretos
Verificação
Automatizada
bash

node test_folha_mensal.js
Cenário 1: Salário R$ 3.000, 30 dias, sem dependentes
Cenário 2: Salário R$ 3.000, com 2 faltas
Cenário 3: Adiantamento 40%
Cenário 4: Com dependente
Manual
Criar/editar rubrica na tela → verificar se incidências foram salvas no banco
Processar folha → verificar holerites com todos os itens
IMPORTANT

O problema mais grave é o BUG R1: a tela de Rubricas parece funcionar (não dá erro), mas todas as configurações de incidências e bases são descartadas silenciosamente porque os nomes das colunas estão trocados. Isso faz o motor calcular com todas as flags em false, resultando em bases zeradas e impostos zerados.

WARNING

BUG 12 continua sendo um showstopper — a Edge Function crasha ao tentar processar adiantamento.

CAUTION

Preciso da sua confirmação para prosseguir. A correção envolve: 1 migração SQL para alinhar o schema, edições no motor (Edge Function), e edições na tela de Rubricas.











SEQUENCIA DE CORREÇÃO

Tarefas — Correção Motor de Folha coupleRH
Etapa 1 — Alinhar Schema do Banco com a Tela de Rubricas
 Criar migração 00048_fix_rubrics_schema.sql com colunas faltantes
 Executar migração no Supabase
Etapa 2 — Corrigir Motor de Cálculo (Edge Function)
 BUG 12: Corrigir const → let no index.ts (crash adiantamento)
 BUG 5: Adicionar query de dependentes no index.ts
 BUG 1: Buscar salário base por '101' OU '1001'
 BUG 8: Corrigir filtro UUID em payslip_items
 BUG 3: Subtrair bases quando rubrica é DEDUCTION no PayrollEngine.ts
 BUG 7: Buscar rubricas legais por código '901'/'902'/'903'
 BUG R3: Aceitar calculation_type em inglês (HOURS, DAYS, etc.)
 BUG 11: Validar líquido negativo
 Compatibilizar leitura de incidências (nomes antigos + novos)
Etapa 3 — Corrigir Tela de Rubricas
 BUG R4: Mostrar calculation_base para todos os tipos
 BUG R5: Adicionar campo factor ao formulário
 BUG R3: Unificar valores de calculation_type/calculation_form
 Corrigir leitura das colunas ao abrir modal (nomes corretos)
Etapa 4 — Seed de Rubricas e Limpeza
 Criar migração 00049_fix_rubrics_and_codes.sql
 Limpar rubricas duplicadas
 Criar rubricas 150/160 para Espelho de Ponto
Verificação
 Testar processamento da folha mensal
 Atualizar documentação