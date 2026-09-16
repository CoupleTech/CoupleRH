# Pesquisa de Mercado e Legislação CLT — Sistema coupleRH

> Documento gerado em 07/09/2026 com base em pesquisa atualizada da CLT vigente, tabelas legais 2026 e análise dos principais concorrentes do mercado brasileiro de sistemas de RH/DP.

---

# PARTE 1 — LEGISLAÇÃO TRABALHISTA BRASILEIRA (CLT 2026)

---

## 1. Parâmetros Gerais 2026

| Parâmetro | Valor 2026 |
|---|---|
| **Salário Mínimo** | R$ 1.621,00 |
| **Teto INSS** | R$ 8.475,55 |
| **Dedução por Dependente (IRRF)** | R$ 189,59/mês |
| **Desconto Simplificado IRRF** | R$ 607,20/mês |
| **Salário-Família (Cota)** | R$ 67,54 por dependente |
| **Limite Salário-Família** | Remuneração até R$ 1.980,38 |
| **FGTS (Alíquota CLT)** | 8% patronal |
| **FGTS (Aprendiz)** | 2% |
| **FGTS (Doméstico)** | 11,2% (8% + 3,2% reserva) |
| **Vale-Transporte (Desc. Máx.)** | 6% do salário-base |
| **eSocial Versão Vigente** | S-1.3 (com NT 06/2026) |

---

## 2. Tabela INSS 2026 — Cálculo Progressivo

O INSS é calculado de forma **progressiva** (por faixas), não por alíquota única.

| Faixa Salarial (R$) | Alíquota | Parcela a Deduzir (R$) |
|---|---|---|
| Até 1.621,00 | 7,5% | — |
| De 1.621,01 até 2.902,84 | 9,0% | 24,32 |
| De 2.902,85 até 4.354,27 | 12,0% | 111,40 |
| De 4.354,28 até 8.475,55 | 14,0% | 198,49 |

### Exemplo de cálculo para salário de R$ 5.000,00:

```
Faixa 1: 1.621,00 × 7,5% = 121,58
Faixa 2: (2.902,84 - 1.621,00) × 9% = 115,37
Faixa 3: (4.354,27 - 2.902,84) × 12% = 174,17
Faixa 4: (5.000,00 - 4.354,27) × 14% = 90,40

TOTAL INSS = R$ 501,52
```

> **Regra para o Motor:** NUNCA aplicar uma alíquota única sobre o salário bruto. Sempre fatiar por faixas.

---

## 3. Tabela IRRF 2026

### 3.1 Tabela Progressiva Base

| Base de Cálculo Mensal (R$) | Alíquota | Parcela a Deduzir (R$) |
|---|---|---|
| Até 2.428,80 | Isento | 0,00 |
| De 2.428,81 até 2.826,65 | 7,5% | 182,16 |
| De 2.826,66 até 3.751,05 | 15,0% | 394,16 |
| De 3.751,06 até 4.664,68 | 22,5% | 675,49 |
| Acima de 4.664,68 | 27,5% | 908,73 |

### 3.2 Redutor Adicional 2026 (Isenção Expandida)

| Rendimento Mensal (R$) | Redutor |
|---|---|
| Até 5.000,00 | Até R$ 312,89 (zera o imposto) |
| De 5.000,01 até 7.350,00 | `R$ 978,62 - (0,133145 × Rend. Tributáveis)` |
| Acima de 7.350,00 | Sem redutor adicional |

### 3.3 Fluxo de Cálculo do IRRF na Folha

```
1. Rendimento Bruto
2. (-) INSS
3. (-) Dependentes × R$ 189,59  OU  Desconto Simplificado R$ 607,20 (o que for maior)
4. (-) Pensão Alimentícia (se houver)
5. = Base de Cálculo IRRF
6. Aplicar tabela progressiva
7. (-) Parcela a deduzir
8. = IRRF Bruto
9. (-) Redutor adicional (se renda ≤ R$ 7.350)
10. = IRRF Final
```

> **Regra para o Motor:** Permitir ao sistema escolher automaticamente entre dedução por dependentes e desconto simplificado (o mais vantajoso para o empregado).

---

## 4. FGTS 2026

### 4.1 Regras de Recolhimento

- Alíquota: **8%** sobre a remuneração bruta (CLT)
- Base: Todas as verbas de natureza salarial (salário, HE, adicionais, comissões)
- Vencimento: Dia 20 de cada mês (ou dia útil anterior)
- Pagamento: Exclusivamente via **Pix** (FGTS Digital)
- Integração: Totalmente via **eSocial** (eventos S-1200, S-2299)

### 4.2 Multa Rescisória

| Tipo de Rescisão | Multa FGTS |
|---|---|
| Sem justa causa | 40% do saldo total |
| Acordo (Art. 484-A) | 20% do saldo total |
| Pedido de demissão | 0% |
| Justa causa | 0% |

> **FGTS NÃO É DESCONTO DO EMPREGADO.** É obrigação patronal. Deve ser tratado separadamente na folha.

---

## 5. Férias — Regras Completas

### 5.1 Períodos

- **Aquisitivo:** 12 meses de trabalho → Direito a 30 dias
- **Concessivo:** 12 meses seguintes ao aquisitivo → Prazo para concessão
- **Férias vencidas:** Se não concedidas no concessivo → Pagamento em DOBRO

### 5.2 Fracionamento (pós-Reforma)

- Até **3 períodos**, com concordância do empregado
- Um período ≥ 14 dias corridos
- Demais períodos ≥ 5 dias corridos cada
- Proibido iniciar nos 2 dias antes de feriado ou DSR

### 5.3 Cálculo de Férias

```
Remuneração de Férias = Salário + Médias (HE, Noturno, etc.)
(+) 1/3 Constitucional
(-) INSS sobre o total
(-) IRRF sobre o total (após INSS)
= Líquido de Férias
```

### 5.4 Abono Pecuniário

- Empregado pode "vender" até 1/3 dos dias (10 dias)
- Pedido até 15 dias antes do fim do aquisitivo
- **Abono + seu 1/3 NÃO incidem INSS nem IRRF**

### 5.5 Redução por Faltas (Art. 130 CLT)

| Faltas Injustificadas (no aquisitivo) | Dias de Férias |
|---|---|
| Até 5 | 30 dias |
| 6 a 14 | 24 dias |
| 15 a 23 | 18 dias |
| 24 a 32 | 12 dias |
| Acima de 32 | Perde o direito |

---

## 6. 13º Salário — Regras Completas

### 6.1 Proporcionalidade

- **1/12 por mês** trabalhado (mês com ≥ 15 dias = conta como avo)
- Base: Salário bruto + médias habituais (HE, noturno, insalubridade, comissões)

### 6.2 Parcelas e Prazos

| Parcela | Prazo | Cálculo | Incidências |
|---|---|---|---|
| 1ª Parcela | 01/fev a 30/nov | 50% do bruto | Sem INSS, sem IRRF, **com FGTS** |
| 2ª Parcela | Até 20/dez | Restante com descontos | Com INSS, com IRRF, **com FGTS** |

### 6.3 Fluxo de Cálculo

```
13º Bruto = (Salário + Médias) / 12 × Avos
1ª Parcela = 13º Bruto / 2
FGTS da 1ª Parcela = 1ª Parcela × 8%

2ª Parcela:
  INSS sobre o 13º Total (tabela progressiva)
  IRRF sobre o 13º Total (tabela separada do salário mensal)
  Líquido = 13º Total - INSS - IRRF - 1ª Parcela
  FGTS da 2ª Parcela = (13º Total - 1ª Parcela) × 8%
```

> **Regra Fundamental:** 13º é calculado em SEPARADO da folha mensal. IRRF do 13º tem apuração própria, não soma com o salário do mês.

---

## 7. Rescisão Contratual

### 7.1 Verbas por Tipo de Rescisão

| Verba | Sem Justa Causa | Pedido Demissão | Justa Causa | Acordo (484-A) |
|---|---|---|---|---|
| Saldo de Salário | ✅ | ✅ | ✅ | ✅ |
| Aviso Prévio (Ind.) | ✅ | ❌ | ❌ | 50% |
| 13º Proporcional | ✅ | ✅ | ❌ | ✅ |
| Férias Proporc. + 1/3 | ✅ | ✅ | ❌ | ✅ |
| Férias Vencidas + 1/3 | ✅ | ✅ | ✅ | ✅ |
| Saque FGTS | ✅ | ❌ | ❌ | 80% |
| Multa FGTS | 40% | 0% | 0% | 20% |
| Seguro-Desemprego | ✅ | ❌ | ❌ | ❌ |

### 7.2 Aviso Prévio Proporcional

- Mínimo: **30 dias**
- (+) **3 dias por ano completo** de serviço
- Máximo: **90 dias** (30 + 60)

### 7.3 Prazo de Pagamento

- **10 dias corridos** após o término do contrato (qualquer modalidade)

---

## 8. Horas Extras, Adicionais e DSR

### 8.1 Hora Extra

| Situação | Adicional Mínimo |
|---|---|
| Dias úteis | 50% |
| Domingos e Feriados | 100% |

**Cálculo:**
```
Valor Hora = Salário / Divisor (ex: 220 para 44h/sem)
HE 50% = Valor Hora × 1,50 × Quantidade
HE 100% = Valor Hora × 2,00 × Quantidade
```

### 8.2 Adicional Noturno

- Período: **22h às 5h** (urbano)
- Adicional: mínimo **20%** sobre a hora diurna
- Hora noturna reduzida: **52 min 30 seg** (fator: 60/52,5 = 1,1429)

### 8.3 Insalubridade

| Grau | Base de Cálculo | Adicional |
|---|---|---|
| Mínimo | Salário mínimo | 10% |
| Médio | Salário mínimo | 20% |
| Máximo | Salário mínimo | 40% |

### 8.4 Periculosidade

- Adicional: **30%** sobre o salário-base (não sobre o mínimo)

### 8.5 DSR sobre Horas Extras

```
DSR = (Total HE no mês / Dias úteis do mês) × Domingos e Feriados do mês
```

> Insalubridade e periculosidade já remuneram o DSR (pagos mensalmente), sem reflexo adicional.

---

## 9. Faltas e Ausências

### 9.1 Desconto de Falta Injustificada

```
Desconto = Salário / 30 × Dias de falta
```

### 9.2 Perda do DSR

- Falta injustificada na semana = Perda do DSR da semana inteira
- O desconto do DSR é **integral** (1 dia), independentemente de quantas faltas na semana

### 9.3 Faltas Justificadas (Art. 473 CLT)

| Motivo | Dias |
|---|---|
| Falecimento (cônjuge, ascendente, descendente, irmão) | 2 |
| Casamento | 3 |
| Nascimento de filho (pai) | 5 |
| Doação de sangue | 1 por ano |
| Alistamento eleitoral | 2 |
| Serviço militar | Período necessário |
| Vestibular | Dias de prova |
| Comparecimento judicial | Período necessário |
| Consulta médica (gestante) | Período necessário |

---

## 10. Vale-Transporte

- **Desconto máximo:** 6% do salário-base (não inclui adicionais)
- **Regra:** Descontar o MENOR entre 6% do salário e o custo real do transporte
- **Natureza:** Indenizatória → NÃO incide INSS, FGTS, IRRF, 13º, férias
- O empregado pode recusar formalmente
- Proporcional em regime híbrido (dias presenciais)

---

## 11. Pensão Alimentícia

- Base: Definida pela **decisão judicial** (ofício)
- Normalmente sobre o "**líquido legal**" (Bruto - INSS - IRRF)
- **Não** se deduzem descontos voluntários (plano saúde, empréstimos)
- Prioridade sobre todos os descontos facultativos
- Limite usual: 50% dos rendimentos líquidos
- Incide sobre: Salário, HE habituais, adicionais, 13º, férias + 1/3

---

## 12. Salário-Família

- Cota: **R$ 67,54** por dependente
- Limite: Remuneração ≤ R$ 1.980,38
- Dependentes: Filhos/enteados até 14 anos ou inválidos de qualquer idade
- Exige: Certidão de nascimento, carteira de vacinação (até 6 anos), frequência escolar (7 a 14 anos)
- Renovação semestral da documentação

---

## 13. eSocial 2026 — Versão S-1.3

### 13.1 Eventos Prioritários para Sistema de Folha

| Evento | Descrição | Tipo |
|---|---|---|
| S-1000 | Empregador/Contribuinte | Tabela |
| S-1005 | Estabelecimentos | Tabela |
| S-1010 | Rubricas | Tabela |
| S-1020 | Lotações Tributárias | Tabela |
| S-1070 | Processos Administrativos/Judiciais | Tabela |
| S-2200 | Cadastramento/Admissão | Não Periódico |
| S-2205 | Alteração de Dados Cadastrais | Não Periódico |
| S-2206 | Alteração Contratual | Não Periódico |
| S-2230 | Afastamento Temporário | Não Periódico |
| S-2299 | Desligamento | Não Periódico |
| S-1200 | Remuneração do Trabalhador | Periódico |
| S-1210 | Pagamentos | Periódico |
| S-1298 | Reabertura de Eventos | Periódico |
| S-1299 | Fechamento de Eventos | Periódico |
| S-2210 | CAT (Comunicação Acidente) | Não Periódico |
| S-2220 | Monitoramento Saúde | Não Periódico |
| S-2240 | Condições Ambientais | Não Periódico |
| S-2500 | Processos Trabalhistas | Não Periódico |

### 13.2 Regras de Conformidade

- XML criptografado com certificado A1/A3
- Validação de dados contra esquemas XSD
- Controle de fila e retransmissão de eventos rejeitados
- Correlação entre eventos (ex: S-2200 antes do S-1200)
- Substituição completa da DIRF em 2026

---

## 14. Trabalho aos Domingos e Feriados (Regra 2026)

- A partir de 01/03/2026: Somente com previsão em **convenção ou acordo coletivo**
- Afeta comércio e serviços diretamente

---

## 15. NR-1 — Riscos Psicossociais (2026)

- Obrigatório gerenciar riscos psicossociais no PGR (Programa de Gerenciamento de Riscos)
- Foco: Saúde mental no trabalho
- Impacta diretamente o módulo de SST do sistema

---

# PARTE 2 — ANÁLISE DE MERCADO (CONCORRENTES)

---

## 1. Mapa de Concorrentes

| Sistema | Foco Principal | Porte Alvo | Pontos Fortes | Pontos Fracos |
|---|---|---|---|---|
| **Senior HCM** | DP + Gestão de Pessoas | Grande | Profundidade de cálculos, customização | Implementação longa, custo alto |
| **TOTVS (RM/Protheus)** | ERP + DP | Médio/Grande | Ecossistema amplo (Financeiro, Contábil) | Complexidade de parametrização |
| **Sólides** | DP + Cultura/Talentos | PME | People Analytics, DISC, UI moderna | Menos robusto em cálculos complexos |
| **Convenia** | DP Simplificado | PME | Admissão digital, interface intuitiva | Limitado em rescisões complexas |
| **Buk** | DP + Experiência | PME/Médio | App mobile, automação eSocial | Relativamente novo no mercado BR |
| **Domínio Sistemas** | Contabilidade + DP | Contadores | Integração contábil nativa | Interface antiga |
| **Benway** | DP Acessível | PME | Custo-benefício | Menos funcionalidades avançadas |

---

## 2. Funcionalidades que Todos os Líderes Oferecem

### 2.1 Módulo Obrigatório (Table Stakes)

- [x] Cadastro de empresa, departamentos, cargos
- [x] Cadastro de empregados (admissão digital)
- [x] Contratos (tipos, prazos, histórico)
- [x] Folha de pagamento mensal automatizada
- [x] Cálculo de INSS, IRRF, FGTS
- [x] 13º salário (1ª e 2ª parcela)
- [x] Férias (programação, cálculo, fracionamento)
- [x] Rescisão (todos os motivos + TRCT)
- [x] Holerites digitais (PDF/Online)
- [x] Integração eSocial
- [x] Rubricas configuráveis
- [x] Benefícios (VT, VR, VA, Saúde)
- [x] Controle de ponto/jornada
- [x] Relatórios básicos (headcount, turnover)

### 2.2 Diferenciais Competitivos (o que diferencia os melhores)

- [ ] **Memória de Cálculo Detalhada** — Poucos mostram o passo-a-passo do cálculo
- [ ] **Motor de Fórmulas Configurável** — Sem necessidade de programação
- [ ] **Versionamento de Regras Legais** — Recalcular folha passada com regras da época
- [ ] **Auditoria Completa** — Quem mudou o quê, quando e por quê
- [ ] **Convenções Coletivas** — Parametrização de CCT/ACT por sindicato
- [ ] **Dissídio Retroativo** — Recálculo automático de diferenças
- [ ] **Folha Complementar** — Pagamento de diferenças com apuração correta
- [ ] **Pensão Alimentícia** — Motor específico com ofício judicial
- [ ] **Adiantamento Salarial** — Com compensação automática
- [ ] **Banco de Horas** — Crédito/débito com vencimentos
- [ ] **Portal do Trabalhador** — Self-service (holerites, férias, ponto)
- [ ] **People Analytics / BI** — Dashboards estratégicos

---

## 3. Oportunidades para o coupleRH se Diferenciar

### 3.1 Transparência Total (USP — Unique Selling Point)

A maioria dos sistemas trata a folha como **caixa preta**. O coupleRH pode ser o primeiro a oferecer **transparência total do cálculo**:

- Memória de cálculo exposta ao usuário (DP e trabalhador)
- Cada verba mostra: base, fórmula, tabela utilizada, versão da regra
- Permite ao trabalhador entender seu holerite sem ligar no DP

### 3.2 Arquitetura Moderna e Acessível

- Cloud-native (Supabase + Edge Functions)
- Sem necessidade de servidor local
- Menor custo de entrada que Senior/TOTVS
- Interface moderna vs. sistemas legados (Domínio)

### 3.3 Motor Configurável sem Código

- Rubricas com fórmulas editáveis pelo DP
- Tabelas legais versionadas sem deploy de código
- Convenções coletivas parametrizáveis

---

# PARTE 3 — CHECKLIST DE FUNCIONALIDADES OBRIGATÓRIAS

---

## Para ser viável no mercado, o coupleRH PRECISA ter:

### Cadastros Fundamentais
- [ ] Empresa (CNPJ, regime, CNAE)
- [ ] Departamentos, setores, cargos (CBO), centros de custo
- [ ] Empregados (dados pessoais, bancários, documentos)
- [ ] Contratos (tipos, vigência, salário, jornada)
- [ ] Dependentes (com vigência e classificação IRRF/SF)

### Jornada e Ponto
- [ ] Jornadas configuráveis (44h, 40h, 36h, 12x36, escalas)
- [ ] Horários (entrada, saída, intervalo)
- [ ] Feriados (nacionais, estaduais, municipais, empresa)
- [ ] Controle de ponto (marcações, tolerância)
- [ ] Cálculo de HE, noturno, atrasos, faltas, DSR

### Rubricas e Eventos
- [ ] Cadastro completo de rubricas (tipo, incidências, bases, fórmula, vigência, eSocial)
- [ ] Lançamento de eventos variáveis por competência
- [ ] Separação clara: Rubrica (regra) vs Evento (ocorrência)

### Motor de Cálculo
- [ ] Salário proporcional (admissão/demissão no mês)
- [ ] Horas extras (50%, 100%, customizáveis)
- [ ] Adicional noturno (com hora reduzida)
- [ ] Insalubridade (graus min/méd/máx)
- [ ] Periculosidade (30%)
- [ ] DSR sobre variáveis
- [ ] Faltas e atrasos (com perda de DSR)
- [ ] Benefícios (VT 6%, VR, VA, Saúde)
- [ ] Pensão alimentícia (conforme ofício)
- [ ] Adiantamento salarial
- [ ] INSS progressivo (tabela versionada)
- [ ] IRRF (com redutor 2026, dependentes/simplificado)
- [ ] FGTS patronal (8%)
- [ ] Salário-família
- [ ] 13º Salário (1ª e 2ª parcela separadas)
- [ ] Férias (remuneração, 1/3, abono, médias)
- [ ] Rescisão (por motivo, com verbas específicas)
- [ ] Aviso prévio (proporcional, trabalhado/indenizado)
- [ ] Folha complementar (diferenças)
- [ ] Dissídio retroativo (recálculo)
- [ ] Encargos patronais (INSS, RAT, FAP, Terceiros)

### Memória e Auditoria
- [ ] Memória de cálculo detalhada para cada verba
- [ ] Trilha de auditoria (quem, quando, o quê)
- [ ] Versionamento de regras e tabelas

### Controle e Fechamento
- [ ] Estados da folha (Rascunho → Calculada → Conferência → Fechada)
- [ ] Bloqueio de edição pós-fechamento
- [ ] Fluxo de reabertura controlado

### eSocial
- [ ] Geração de XML para eventos de tabela, admissão, remuneração, desligamento
- [ ] Controle de fila, retransmissão e tratamento de rejeições
- [ ] Correlação entre eventos

### Relatórios e Portais
- [ ] Holerite digital (PDF + Online)
- [ ] Espelho de ponto
- [ ] TRCT digital
- [ ] Portal do trabalhador (self-service)
- [ ] Relatórios de BI (headcount, turnover, absenteísmo)

### Segurança e LGPD
- [ ] RLS por tenant/empresa
- [ ] Dados sensíveis criptografados
- [ ] Controle de acesso por perfil (RBAC)
- [ ] Logs de acesso a dados pessoais

---

# PARTE 4 — FONTES E REFERÊNCIAS

| Referência | Descrição |
|---|---|
| CLT (DL 5.452/1943) | Consolidação das Leis do Trabalho |
| CF/88 Art. 7º | Direitos dos trabalhadores |
| Lei 7.418/1985 | Vale-Transporte |
| Lei 605/1949 | DSR |
| Lei 4.090/1962 | 13º Salário |
| Lei 8.036/1990 | FGTS |
| Art. 130 CLT | Redução de férias por faltas |
| Art. 473 CLT | Faltas justificadas |
| Art. 484-A CLT | Rescisão por acordo |
| Portaria MTP 671/2021 | REP-A, REP-C, REP-P |
| NR-1 (2026) | Riscos psicossociais |
| eSocial S-1.3 + NT 06/2026 | Leiautes vigentes |
| Portaria Interministerial MPS/MF 13/2026 | Tabelas INSS/SF |
| Gov.br/eSocial | Portal oficial eSocial |
| Gov.br/FGTS Digital | Portal oficial FGTS Digital |
