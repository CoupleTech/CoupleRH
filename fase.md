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

> **Status Atual do Projeto:** Fase 1 (Estrutura Organizacional) em andamento.

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
