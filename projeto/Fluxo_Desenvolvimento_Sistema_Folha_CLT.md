# Fluxo de Desenvolvimento — Sistema de Folha CLT

## 1. Objetivo

Este documento define a ordem recomendada para construir um sistema de RH e folha de pagamento baseado na CLT.

A proposta não é desenvolver primeiro todas as telas e somente depois criar o motor de cálculo. O sistema deve ser construído em camadas, fazendo os cadastros e regras alimentarem progressivamente o motor.

Princípio central:

> **Cadastro define a realidade. Regra define o comportamento. Evento registra o que aconteceu. Motor calcula. Folha registra o resultado. Memória explica como o resultado foi obtido.**

---

# 2. Visão geral da arquitetura

```text
EMPRESA
   │
   ├── Estrutura organizacional
   │   ├── Departamentos
   │   ├── Setores
   │   ├── Cargos
   │   └── Centros de custo
   │
   ├── Configurações
   │   ├── Parâmetros trabalhistas
   │   ├── Encargos
   │   ├── Benefícios
   │   └── Regras internas
   │
   └── EMPREGADOS
          │
          ├── Contrato
          ├── Salário
          ├── Jornada
          ├── Escala
          ├── Dependentes
          ├── Férias
          ├── Afastamentos
          └── Benefícios
                    │
                    ▼
             EVENTOS DA FOLHA
                    │
                    ▼
                 RUBRICAS
                    │
                    ▼
            MOTOR DE CÁLCULO
                    │
         ┌──────────┼───────────┐
         ▼          ▼           ▼
       BASES      REGRAS      ENCARGOS
         │
    ┌────┼─────┐
    ▼    ▼     ▼
   INSS IRRF  FGTS
    │    │     │
    └────┼─────┘
         ▼
      DESCONTOS
         │
         ▼
    SALÁRIO LÍQUIDO
         │
         ▼
 MEMÓRIA DE CÁLCULO
         │
         ▼
      AUDITORIA
         │
         ▼
     FECHAMENTO
```

---

# 3. Princípio de desenvolvimento

Não construir o sistema da seguinte maneira:

```text
Todas as telas
        ↓
Todos os cadastros
        ↓
Motor no final
```

Esse modelo cria o risco de descobrir tarde que os dados cadastrados não possuem estrutura suficiente para alimentar o cálculo.

Também não construir:

```text
Motor completo
        ↓
Telas depois
```

porque o motor depende de dados reais e regras configuráveis.

A abordagem recomendada é incremental:

```text
Cadastro
   ↓
Regra
   ↓
Integração
   ↓
Motor pequeno
   ↓
Teste
   ↓
Novo cadastro
   ↓
Nova regra
   ↓
Evolução do motor
```

---

# 4. Fases do projeto

## FASE 0 — Análise do sistema existente

Antes de alterar código:

1. mapear banco de dados atual;
2. identificar tabelas existentes;
3. identificar empregados;
4. identificar contratos;
5. identificar folha;
6. identificar rubricas existentes;
7. identificar eventos;
8. identificar benefícios;
9. identificar descontos;
10. identificar configurações atuais;
11. identificar cálculos já existentes;
12. identificar telas existentes;
13. identificar integrações;
14. identificar funcionalidades que devem ser preservadas.

### Regra

Não destruir estruturas existentes sem avaliar dependências.

O agente deve primeiro produzir um mapa:

```text
Tabela
   ↓
Quem utiliza
   ↓
Qual tela alimenta
   ↓
Qual cálculo depende
   ↓
Qual será a nova estrutura
```

---

# 5. FASE 1 — Empresa e estrutura organizacional

Construir primeiro a estrutura que representa a empresa.

## Cadastros

### Empresa

Campos conceituais:

```text
id
razão social
nome fantasia
CNPJ
endereço
regime tributário
atividade
configurações fiscais
configurações trabalhistas
status
```

### Departamentos

```text
id
empresa_id
nome
código
status
```

### Setores

```text
id
empresa_id
departamento_id
nome
status
```

### Cargos

```text
id
empresa_id
nome
CBO
descrição
nível
status
```

### Centros de custo

```text
id
empresa_id
código
nome
status
```

### Lotações / locais de trabalho

Quando aplicável:

```text
id
empresa_id
nome
endereço
centro_custo_id
status
```

---

# 6. FASE 2 — Jornada, horários e escalas

Esta fase deve ocorrer antes de desenvolver cálculos avançados de horas extras.

## Jornada

Representa a regra de trabalho.

Exemplos:

```text
44 horas semanais
40 horas semanais
36 horas semanais
12x36
6x1
5x2
escala personalizada
```

Dados:

```text
nome
horas_semanais
horas_mensais_referencia
intervalo
tolerância
divisor
regras de descanso
```

## Horários

Representa a distribuição diária.

Exemplo:

```text
Entrada 08:00
Saída intervalo 12:00
Retorno 13:00
Saída 17:00
```

## Escala

Relaciona empregado com jornada/horário.

A escala deve suportar:

```text
dias trabalhados
dias de folga
horário
ciclo
vigência
```

## Feriados

```text
nacional
estadual
municipal
empresa
data
```

### Resultado desta fase

O sistema precisa conseguir responder:

> Quantas horas esse empregado deveria trabalhar em determinada data?

Essa informação será utilizada pelo controle de ponto e pelos cálculos.

---

# 7. FASE 3 — Tipos de contrato

Criar o catálogo de contratos.

Exemplos:

```text
Prazo indeterminado
Prazo determinado
Experiência
Temporário
Aprendiz
Outros conforme necessidade
```

Dados:

```text
tipo
prazo
data_inicio
data_fim
regras_específicas
```

O contrato será utilizado posteriormente em:

- folha;
- férias;
- 13º;
- rescisão;
- aviso prévio;
- elegibilidade de benefícios.

---

# 8. FASE 4 — Cadastro de empregado

Depois da estrutura da empresa:

```text
Empresa
   ↓
Empregado
   ↓
Contrato
```

O cadastro deve suportar:

```text
dados pessoais
dados cadastrais
matrícula
data de admissão
data de desligamento
cargo
departamento
setor
centro de custo
contrato
salário
jornada
escala
dependentes
benefícios
dados bancários
status
```

Separar dados permanentes de dados que possuem vigência.

Exemplo:

```text
Histórico salarial
Histórico de cargo
Histórico de setor
Histórico de jornada
Histórico de centro de custo
```

---

# 9. FASE 5 — Dependentes

Criar cadastro próprio.

Dados:

```text
empregado_id
nome
data_nascimento
grau_parentesco
dependente_irrf
dependente_salario_familia
vigência
```

O motor deve consultar dependentes de acordo com a competência.

Não armazenar apenas `quantidade_dependentes`.

É importante saber quem eram os dependentes na competência calculada.

---

# 10. FASE 6 — Férias e períodos aquisitivos

Criar estrutura antes de desenvolver o cálculo de férias.

## Período aquisitivo

```text
empregado
inicio
fim
dias_direito
situação
```

## Período concessivo

```text
inicio
fim
```

## Férias

```text
data_inicio
data_fim
dias_gozados
abono
status
```

O cadastro de férias deve ser independente do cálculo.

O cálculo utilizará essas informações posteriormente.

---

# 11. FASE 7 — Afastamentos e ausências

Criar cadastro para:

```text
faltas
atrasos
afastamentos
licenças
acidentes
benefícios previdenciários
retornos
```

Cada ocorrência deve conter:

```text
data_inicio
data_fim
tipo
motivo
impacta_salario
impacta_férias
impacta_13
impacta_INSS
impacta_FGTS
```

As incidências não devem ser codificadas apenas no frontend.

---

# 12. FASE 8 — Rubricas

Esta é uma das partes centrais do sistema.

Rubrica não é apenas um nome.

Ela deve definir o comportamento da verba.

## Estrutura mínima

```text
codigo
nome
descricao
tipo
categoria
origem
forma_calculo
base_calculo
percentual
divisor
formula
ordem_calculo
```

## Tipos

```text
PROVENTO
DESCONTO
BASE
INFORMATIVA
```

## Origem

```text
MANUAL
AUTOMATICA
IMPORTADA
INTEGRACAO
```

## Incidências

```text
incide_inss
incide_irrf
incide_fgts
incide_inss_patronal
incide_rat
incide_terceiros
```

## Bases geradas

```text
gera_base_inss
gera_base_irrf
gera_base_fgts
```

## Vigência

```text
vigencia_inicio
vigencia_fim
versao
```

## Natureza eSocial

```text
codigo_natureza
descricao
vigencia
```

---

# 13. FASE 9 — Evento da folha

Separar claramente:

```text
RUBRICA = regra
EVENTO = ocorrência
```

Exemplo:

```text
Rubrica:
Hora Extra 50%

Evento:
Empregado João
10 horas
Competência 09/2026
```

Estrutura:

```text
id
folha_id
empregado_id
rubrica_id
quantidade
referencia
valor_manual
origem
observacao
data_lancamento
usuario
```

---

# 14. FASE 10 — Benefícios

Criar catálogo próprio.

Exemplos:

```text
Vale-transporte
Vale-refeição
Vale-alimentação
Plano de saúde
Plano odontológico
Seguro
Auxílios
```

O benefício deve possuir:

```text
nome
tipo
valor
forma_calculo
percentual
limite
quem paga
parte empregador
parte empregado
gera desconto
incidência
vigência
```

O empregado deve possuir vínculo com o benefício.

Não misturar cadastro do benefício com a ocorrência mensal.

Exemplo:

```text
Benefício = Plano de Saúde
Vínculo = João possui o plano
Ocorrência = coparticipação de R$ 87,00 em setembro
```

---

# 15. FASE 11 — Descontos diversos

Criar estrutura para descontos que não são benefícios.

Exemplos:

```text
Adiantamento
Empréstimo
Consignado
Pensão alimentícia
Coparticipação
Convênio
Faltas
Atrasos
Outros descontos
```

O desconto deve conter:

```text
tipo
regra
valor
percentual
limite
vigência
prioridade
ordem
incidências
```

---

# 16. FASE 12 — Tabelas legais

Criar um módulo de parâmetros legais versionados.

Nunca colocar regras legais espalhadas no código.

## INSS

Tabela por competência.

## IRRF

Tabela por competência.

## FGTS

Parâmetros por competência.

## Outros parâmetros

```text
salário mínimo
dependente
deduções
reduções
limites
alíquotas
```

Cada registro deve possuir:

```text
vigencia_inicio
vigencia_fim
fonte
versao
```

---

# 17. FASE 13 — Motor de cálculo mínimo

Neste ponto o motor pode começar.

Não precisa estar completo.

Primeira versão:

```text
Salário
+
dias trabalhados
+
faltas
+
horas extras
+
descontos
=
resultado inicial
```

Arquitetura:

```text
PayrollEngine
PayrollContext
CalculationResult
CalculationMemory
```

---

# 18. FASE 14 — Primeiro cálculo real

Criar uma folha mensal simples.

Exemplo:

```text
Salário = R$ 3.000,00
Dias trabalhados = 30
```

Resultado:

```text
Salário = R$ 3.000,00
```

Depois testar:

```text
Dias trabalhados = 20

3.000 / 30 × 20
= 2.000
```

O cálculo deve gerar memória.

---

# 19. FASE 15 — Horas extras

Após salário básico funcionar:

```text
Salário
 ↓
Valor hora
 ↓
Hora extra
 ↓
DSR
```

O divisor deve vir da configuração de jornada/contrato, não de um número fixo universal.

Exemplo:

```text
valor_hora = salário / divisor
```

Hora extra 50%:

```text
valor_hora × 1,50 × quantidade
```

---

# 20. FASE 16 — Adicionais e variáveis

Implementar progressivamente:

```text
Adicional noturno
Insalubridade
Periculosidade
Comissão
Gratificação
Prêmio
DSR
Outras verbas variáveis
```

Cada item deve ser uma combinação de:

```text
Rubrica
+
Evento
+
Base
+
Incidência
+
Regra de cálculo
```

---

# 21. FASE 17 — Construção das bases

Antes de calcular impostos, o motor deve consolidar:

```text
BASE_INSS
BASE_IRRF
BASE_FGTS
```

Exemplo conceitual:

```text
Proventos
   ↓
Rubricas que geram base
   ↓
BASE_INSS
```

Cada base precisa ser rastreável.

---

# 22. FASE 18 — INSS

Criar módulo próprio:

```text
INSSCalculator
```

Fluxo:

```text
Eventos
 ↓
Rubricas com incidência
 ↓
BASE_INSS
 ↓
Tabela legal da competência
 ↓
Cálculo progressivo
 ↓
INSS empregado
```

A regra de cálculo deve ser configurável por competência.

---

# 23. FASE 19 — IRRF

Criar módulo próprio:

```text
IRRFCalculator
```

Fluxo:

```text
Rendimentos tributáveis
 ↓
Deduções
 ↓
Dependentes
 ↓
Pensão quando aplicável
 ↓
Desconto simplificado quando aplicável
 ↓
Base IRRF
 ↓
Tabela
 ↓
Redução quando aplicável
 ↓
IRRF
```

---

# 24. FASE 20 — FGTS

Criar módulo:

```text
FGTSCalculator
```

Fluxo:

```text
Rubricas
 ↓
BASE_FGTS
 ↓
Regra de competência
 ↓
FGTS patronal
```

Importante:

> FGTS do empregador não deve ser tratado como desconto do empregado.

---

# 25. FASE 21 — Encargos patronais

Criar módulo separado.

Suportar:

```text
INSS patronal
RAT
FAP
Terceiros
FGTS
outros encargos parametrizados
```

As regras dependem da empresa e da competência.

---

# 26. FASE 22 — Adiantamento salarial

Criar o conceito de adiantamento.

Fluxo:

```text
Adiantamento
    ↓
Pagamento antecipado
    ↓
Registro da obrigação
    ↓
Compensação na folha
```

O adiantamento não deve gerar duplicação do salário.

---

# 27. FASE 23 — Férias

Depois que a folha mensal estiver estável:

```text
Período aquisitivo
 ↓
Direito
 ↓
Férias
 ↓
Média
 ↓
Remuneração de férias
 ↓
1/3
 ↓
Incidências
```

---

# 28. FASE 24 — 13º salário

Construir separadamente da folha mensal.

Suportar:

```text
primeira parcela
segunda parcela
proporcional
rescisão
complementação
```

O motor deve identificar que:

```text
Folha mensal ≠ 13º
```

---

# 29. FASE 25 — Rescisão

A rescisão deve ser um módulo próprio.

Motivos mínimos:

```text
Dispensa sem justa causa
Pedido de demissão
Justa causa
Término do contrato por prazo determinado
Acordo entre as partes
```

Cada motivo possui conjunto específico de verbas.

---

# 30. FASE 26 — Aviso prévio

Separar:

```text
Aviso trabalhado
Aviso indenizado
```

Controlar:

```text
data_inicio
data_fim
dias
dias_trabalhados
dias_indenizados
```

A proporcionalidade legal deve ser parametrizada.

---

# 31. FASE 27 — Folha complementar

Criar:

```text
folha_origem_id
motivo
competência_origem
competência_pagamento
```

Calcular somente as diferenças necessárias.

Exemplo:

```text
Pago = R$ 3.000
Correto = R$ 3.300
Diferença = R$ 300
```

E calcular reflexos quando aplicáveis.

---

# 32. FASE 28 — Dissídio

Criar módulo para:

```text
percentual
data de efeito
competências afetadas
salário antigo
salário novo
```

Recalcular diferenças sobre verbas afetadas.

Possíveis reflexos:

```text
salário
horas extras
DSR
férias
13º
INSS
IRRF
FGTS
```

---

# 33. FASE 29 — Memória de cálculo

A memória não é opcional.

Cada cálculo deve produzir:

```text
rubrica
base
quantidade
percentual
fórmula
resultado
origem
ordem
versão
```

Exemplo:

```text
Rubrica: Hora Extra 50%

Salário: 3.000,00
Divisor: 220
Valor hora: 13,636363
Horas: 10
Percentual: 50%

Cálculo:
13,636363 × 1,50 × 10

Resultado:
204,55
```

---

# 34. FASE 30 — Auditoria

Registrar:

```text
usuário
data
ação
entidade
id
valor anterior
valor novo
motivo
versão do motor
```

Auditar:

```text
alteração de rubrica
alteração de fórmula
alteração de incidência
alteração salarial
cálculo manual
fechamento
reabertura
cancelamento
rescisão
```

---

# 35. FASE 31 — Fechamento da folha

Estados:

```text
RASCUNHO
CALCULADA
CONFERENCIA
FECHADA
REABERTA
CANCELADA
```

Uma folha fechada não pode ser alterada silenciosamente.

Qualquer alteração deve passar por fluxo controlado.

---

# 36. FASE 32 — Versionamento

Salvar:

```text
versao_motor
versao_rubrica
versao_regra
versao_tabela_INSS
versao_tabela_IRRF
versao_FGTS
```

Uma folha de 2026 deve continuar reproduzível no futuro.

---

# 37. Ordem recomendada de construção

A ordem prática fica:

```text
01. Analisar sistema atual

02. Empresa
03. Estrutura organizacional
04. Cargos
05. Departamentos
06. Setores
07. Centros de custo

08. Jornada
09. Horários
10. Escalas
11. Feriados

12. Tipos de contrato
13. Empregados
14. Contratos
15. Histórico salarial
16. Dependentes

17. Férias
18. Afastamentos

19. Rubricas
20. Eventos
21. Benefícios
22. Descontos

23. Tabelas legais

24. Motor básico
25. Salário
26. Faltas
27. Horas extras
28. DSR
29. Adicionais

30. Bases
31. INSS
32. IRRF
33. FGTS
34. Encargos

35. Adiantamento
36. Férias
37. 13º
38. Rescisão
39. Aviso prévio
40. Complementar
41. Dissídio

42. Memória
43. Auditoria
44. Fechamento
45. Versionamento
46. Testes
```

---

# 38. Como o agente deve trabalhar

O agente de programação deve seguir este ciclo:

```text
ENTENDER
   ↓
MODELAR
   ↓
IMPLEMENTAR
   ↓
TESTAR
   ↓
VALIDAR
   ↓
DOCUMENTAR
```

Para cada funcionalidade:

### 1. Entender

Responder:

```text
Qual dado entra?
Quem cadastra?
Quem utiliza?
Qual regra depende dele?
```

### 2. Modelar

Definir:

```text
Tabela
Relacionamentos
Campos
Vigência
Histórico
```

### 3. Implementar

Criar:

```text
Backend
Banco
Serviços
Validações
Interface
```

### 4. Testar

Testar:

```text
Caso normal
Limites
Valores nulos
Valores inválidos
Mudança de competência
Histórico
Reprocessamento
```

### 5. Validar

Confirmar:

```text
Resultado
Memória
Incidências
Auditoria
```

---

# 39. Dependência entre módulos

## Empresa alimenta

```text
Empregados
Contratos
Jornada
Benefícios
Rubricas
Encargos
```

## Jornada alimenta

```text
Ponto
Horas extras
Atrasos
Faltas
DSR
```

## Contrato alimenta

```text
Salário
Jornada
Rescisão
Férias
13º
```

## Rubricas alimentam

```text
Eventos
Bases
Incidências
Motor
Memória
```

## Eventos alimentam

```text
Folha
Motor
Histórico
```

## Motor alimenta

```text
Bases
Impostos
FGTS
Descontos
Líquido
Memória
```

---

# 40. Regra fundamental das Rubricas

Nunca desenvolver o cadastro de rubricas como:

```text
Código
Nome
Valor
```

A rubrica deve responder:

```text
O que é?
Como calcula?
Sobre qual base?
É automática?
Pode ser manual?
Incide INSS?
Incide IRRF?
Incide FGTS?
Gera base?
Tem reflexo?
Qual a vigência?
Qual a natureza eSocial?
Qual a ordem de cálculo?
Qual a fórmula?
```

---

# 41. Regra fundamental do Motor

O motor não deve perguntar somente:

```text
Qual o valor?
```

Ele deve perguntar:

```text
Qual empregado?
Qual contrato?
Qual competência?
Qual tipo de folha?
Quais eventos?
Quais rubricas?
Quais regras vigentes?
Quais incidências?
Quais bases?
Quais tabelas legais?
Quais dependências?
```

---

# 42. O que deve ficar fora do frontend

Nunca implementar no React ou outra camada de apresentação:

```text
INSS
IRRF
FGTS
rescisão
férias
13º
regras de incidência
fórmulas trabalhistas
```

O frontend deve:

```text
coletar
enviar
consultar
exibir
```

O backend deve:

```text
validar
calcular
persistir
auditar
```

---

# 43. Regras de segurança

Não executar fórmulas arbitrárias com:

```text
eval()
Function()
SQL dinâmico
```

Utilizar interpretador controlado.

Somente permitir variáveis e operações previamente aprovadas.

---

# 44. Testes fundamentais

Criar testes automatizados para:

## Salário

```text
salário integral
salário proporcional
admissão no meio do mês
demissão no meio do mês
faltas
```

## Jornada

```text
horas normais
horas extras
adicional noturno
DSR
```

## Tributos

```text
limite inferior
limite superior
mudança de faixa
teto
```

## Férias

```text
férias integrais
proporcionais
vencidas
abono
1/3
```

## 13º

```text
integral
proporcional
primeira parcela
segunda parcela
rescisão
```

## Rescisão

```text
sem justa causa
pedido de demissão
justa causa
prazo determinado
acordo
```

## Outros

```text
adiantamento
complementar
dissídio
```

---

# 45. O que não fazer

```text
Não construir o motor isoladamente.

Não construir todos os cadastros sem pensar no motor.

Não duplicar regra no frontend.

Não usar float para valores monetários.

Não apagar regras históricas.

Não alterar folha fechada diretamente.

Não misturar 13º com folha mensal.

Não tratar FGTS como desconto do empregado.

Não usar a mesma fórmula para todas as rescisões.

Não criar rubricas que escondem regras críticas.

Não permitir fórmulas arbitrárias.

Não salvar somente o resultado final sem memória.

Não ignorar vigência.

Não sobrescrever histórico salarial.

Não espalhar valores legais em diversos arquivos.
```

---

# 46. Primeiro MVP recomendado

Para colocar o sistema em funcionamento com segurança, o primeiro MVP pode ser:

```text
Empresa
Empregado
Contrato
Salário
Jornada
Rubricas
Eventos
Folha mensal
INSS
IRRF
FGTS
Descontos
Memória de cálculo
```

Depois evoluir:

```text
Horas extras
DSR
Benefícios
Férias
13º
Rescisão
Adiantamento
Complementar
Dissídio
Afastamentos
Integrações
```

---

# 47. Resultado esperado

Ao finalizar a arquitetura, o sistema deve permitir:

```text
Cadastrar empresa
      ↓
Cadastrar empregado
      ↓
Cadastrar contrato
      ↓
Definir jornada
      ↓
Cadastrar rubricas
      ↓
Cadastrar benefícios/descontos
      ↓
Lançar eventos
      ↓
Calcular folha
      ↓
Calcular bases
      ↓
Calcular INSS
      ↓
Calcular IRRF
      ↓
Calcular FGTS
      ↓
Calcular descontos
      ↓
Obter líquido
      ↓
Ver memória de cálculo
      ↓
Validar
      ↓
Fechar folha
```

---

# 48. Regra de ouro do projeto

Antes de implementar qualquer cálculo, o agente deve responder:

```text
1. Qual cadastro fornece o dado?
2. Qual regra define o comportamento?
3. Qual rubrica representa a verba?
4. Qual evento representa a ocorrência?
5. Qual é a base?
6. Qual é a incidência?
7. Qual é a tabela legal?
8. Qual é a vigência?
9. Qual é a ordem do cálculo?
10. Como o resultado será auditado?
11. Como o cálculo será reproduzido no futuro?
```

Se uma dessas respostas não existir, a implementação não deve inventar uma regra silenciosamente.

---

# 49. Estratégia final

A arquitetura ideal do projeto é:

```text
CADASTROS
    ↓
REGRAS
    ↓
EVENTOS
    ↓
MOTOR
    ↓
BASES
    ↓
TRIBUTOS / ENCARGOS
    ↓
DESCONTOS
    ↓
RESULTADO
    ↓
MEMÓRIA
    ↓
AUDITORIA
    ↓
FECHAMENTO
```

E o desenvolvimento deve ser incremental:

```text
CADASTRO
   ↓
INTEGRAÇÃO
   ↓
CÁLCULO
   ↓
TESTE
   ↓
PRÓXIMO MÓDULO
```

Essa abordagem permite construir um sistema de folha profissional sem transformar as regras trabalhistas em código espalhado pelas telas.

---

# 50. Diretriz para o agente de programação

O agente deve tratar este documento como **ordem arquitetural**, não como lista rígida de telas.

Sempre que encontrar uma estrutura existente no projeto:

1. analisar;
2. preservar o que estiver correto;
3. adaptar o que estiver incompleto;
4. migrar dados quando necessário;
5. manter compatibilidade;
6. testar antes de substituir.

O objetivo não é apenas "fazer a tela funcionar".

O objetivo é construir uma cadeia confiável:

```text
DADO
  ↓
REGRA
  ↓
EVENTO
  ↓
CÁLCULO
  ↓
RESULTADO
  ↓
MEMÓRIA
  ↓
AUDITORIA
```

Esse é o fluxo que deve orientar toda a evolução do sistema de RH e folha CLT.
