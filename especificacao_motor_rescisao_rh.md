# Motor de Rescisão Trabalhista — Especificação para Desenvolvimento

## Objetivo

Este documento é uma especificação funcional e técnica para implementar o **motor de cálculo de rescisão** do sistema de RH.

O motor deve calcular a rescisão a partir de:

1. Dados do contrato;
2. Motivo do desligamento;
3. Data de desligamento;
4. Tipo de aviso prévio;
5. Salário e médias aplicáveis;
6. Férias e 13º;
7. Dependentes e demais deduções;
8. Histórico de FGTS;
9. Rubricas e regras de incidência.

**Regra principal:** não criar uma fórmula única para todas as rescisões. Cada verba deve possuir uma regra própria de cálculo e de incidência.

> Este documento é uma especificação de software. A legislação e as tabelas oficiais devem ser mantidas versionadas e revisadas quando houver alteração legal. Para produção, o sistema deve ter validação com contador/especialista trabalhista.

---

# 1. Fontes oficiais e premissas

O sistema deve usar como referências principais:

- CLT — Decreto-Lei nº 5.452/1943;
- Lei nº 12.506/2011 — aviso prévio proporcional;
- Lei nº 8.036/1990 — FGTS;
- Lei nº 13.467/2017 — reforma trabalhista, incluindo art. 484-A;
- Tabelas e leiautes do eSocial;
- Manual do eSocial;
- Manual do FGTS Digital;
- Tabelas oficiais vigentes de INSS e IRRF.

O eSocial possui uma **Tabela 19 — Motivos de Desligamento**, com códigos próprios para justa causa, sem justa causa, término de contrato a termo, pedido de demissão e acordo, entre outros. [Fonte oficial: eSocial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-02-2024/tabelas.html).

O FGTS Digital calcula a indenização compensatória sobre a base para fins rescisórios e usa percentuais de 40% ou 20%, conforme o motivo. [Fonte oficial: FGTS Digital](https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/manual-e-documentacao-tecnica/manual-de-orientacao-do-fgts-digital-versao-1-60-de-05-05-2026.pdf).

---

# 2. Motivos suportados pelo produto

O produto deve suportar, no mínimo, os seguintes motivos solicitados:

## 2.1 Rescisão sem justa causa pelo empregador

Código eSocial de referência:

```text
02 — Rescisão sem justa causa, por iniciativa do empregador
```

Características:

- Empregador encerra o vínculo;
- Em contrato por prazo indeterminado, normalmente existe aviso prévio;
- Pode haver aviso trabalhado, indenizado ou parcialmente trabalhado/indenizado;
- Gera, em regra, multa rescisória de FGTS de 40%;
- Em regime de saque-rescisão, há direito ao saque conforme as regras do FGTS;
- Paga as verbas rescisórias cabíveis.

O FGTS Digital informa percentual de 40% para o motivo 02. [Fonte oficial](https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/manual-e-documentacao-tecnica/manual-do-orientacao-do-fgts-digital-versao-1-40-27-02-2026.pdf).

---

## 2.2 Rescisão por pedido de demissão

Código eSocial de referência:

```text
07 — Rescisão do contrato de trabalho por iniciativa do empregado
```

Características:

- Iniciativa do empregado;
- Não há multa de 40% do FGTS;
- O trabalhador não recebe aviso prévio indenizado do empregador;
- Se o empregado deveria cumprir aviso e não o cumpre, pode existir desconto do aviso, observadas as regras aplicáveis;
- Férias proporcionais são calculadas conforme as regras aplicáveis;
- 13º proporcional é devido conforme as regras aplicáveis.

O eSocial prevê expressamente o motivo 07. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-02-2024/tabelas.html).

---

## 2.3 Rescisão por justa causa

Código eSocial de referência:

```text
01 — Rescisão com justa causa, por iniciativa do empregador
```

Características gerais:

- Iniciativa do empregador;
- Não há aviso prévio;
- Não há multa rescisória de 40% do FGTS;
- Não há aviso prévio indenizado;
- O cálculo deve pagar apenas as verbas legalmente devidas no caso concreto, incluindo saldo de salário e férias vencidas quando existentes;
- Não assumir automaticamente férias proporcionais e 13º proporcional sem validar a regra vigente e a situação concreta.

O eSocial classifica o motivo 01 como justa causa por iniciativa do empregador. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-02-2024/tabelas.html).

---

## 2.4 Término de contrato por prazo determinado

Código eSocial de referência:

```text
06 — Rescisão por término do contrato a termo
```

Características:

- O contrato chega à data prevista;
- Não tratar como aviso prévio comum de contrato por prazo indeterminado;
- Verificar se existe cláusula assecuratória do direito recíproco de rescisão antecipada;
- Se houver encerramento antecipado, o motivo poderá ser diferente e o motor deve seguir as regras da rescisão antecipada;
- No término normal, não aplicar automaticamente aviso prévio de 30 dias;
- Verificar FGTS e demais verbas conforme o tipo de contrato e motivo.

O eSocial possui motivo específico para término de contrato a termo e distingue rescisão antecipada do contrato a termo. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-02-2024/tabelas.html).

---

## 2.5 Rescisão por acordo entre as partes — art. 484-A da CLT

Código eSocial:

```text
33 — Rescisão por acordo entre as partes (art. 484-A da CLT)
```

Características principais:

- Iniciativa conjunta;
- Aviso prévio indenizado: pagamento pela metade;
- Multa do FGTS: 20%;
- Saque do FGTS: segue as regras específicas do acordo;
- Demais verbas devem ser calculadas integralmente quando cabíveis.

O FGTS Digital identifica o motivo 33 e aplica percentual de 20% para a indenização compensatória. [Fonte oficial](https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/manual-e-documentacao-tecnica/manual-do-orientacao-do-fgts-digital-versao-1-40-27-02-2026.pdf).

---

# 3. Tipos de aviso prévio

No sistema, criar um enum:

```text
TRABALHADO
INDENIZADO
DISPENSADO
MISTO
```

Embora a interface possa mostrar os três tipos solicitados pelo produto, **recomenda-se suportar MISTO internamente**, pois o eSocial prevê situações em que parte do aviso é trabalhada e parte é indenizada.

O Manual Web Geral do eSocial trata expressamente o aviso prévio misto, indicando parte trabalhada e parte indenizada. [Fonte oficial](https://www.gov.br/esocial/pt-br/empresas/manual-web-geral).

---

# 4. Aviso prévio — conceito

Para contratos por prazo indeterminado, o aviso prévio dado pelo empregador é de no mínimo 30 dias.

A Lei nº 12.506/2011 acrescenta 3 dias por ano de serviço, até o limite total de 90 dias.

Regra básica:

```text
anos_completos = anos de serviço considerados para aviso

dias_aviso = 30 + (anos_completos × 3)

dias_aviso = mínimo 30
dias_aviso = máximo 90
```

Exemplo:

```text
0 anos completos → 30 dias
1 ano completo   → 33 dias
2 anos completos → 36 dias
3 anos completos → 39 dias
...
20 anos          → 90 dias
```

O Manual do eSocial apresenta essa mesma lógica geral para o aviso prévio proporcional. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/manual-do-esocial-segurado-especial-versao-05-02-2026-versao-completa.pdf).

> **Implementação:** não calcular aviso apenas pelo ano-calendário. Calcular pelo tempo de serviço do vínculo, respeitando a regra legal e eventuais regras específicas.

---

# 5. Aviso trabalhado

Quando o aviso é trabalhado:

- O empregado continua prestando serviços durante o período;
- Os dias correspondentes não devem ser tratados como uma verba adicional de aviso indenizado;
- O período integra o vínculo;
- Deve ser considerada a data efetiva de término do aviso;
- O sistema deve calcular a remuneração normal do período trabalhado na folha correspondente.

No desligamento, não adicionar:

```text
Aviso prévio indenizado = R$ X
```

quando o aviso foi integralmente trabalhado.

---

# 6. Aviso indenizado

Quando o aviso é indenizado:

- O empregado não trabalha os dias indenizados;
- O empregador paga a verba correspondente;
- O sistema deve calcular a data projetada do término do aviso;
- A projeção deve ser considerada nas verbas que dependem da projeção, conforme a legislação e regras do eSocial.

Fórmula:

```text
valor_aviso = remuneração_base_aviso / 30 × dias_aviso
```

Exemplo:

```text
Salário = R$ 6.500
Aviso = 30 dias

6.500 / 30 × 30
= R$ 6.500,00
```

O eSocial mantém campo específico para data projetada do término do aviso prévio indenizado. [Fonte oficial](https://www.gov.br/esocial/pt-br/empresas/manual-web-geral).

---

# 7. Aviso dispensado

"Dispensado" precisa ser tratado com cuidado porque pode representar situações diferentes.

## Cenário recomendado na interface

Perguntar:

```text
Quem deu o aviso?
[Empregador]
[Empregado]

O aviso será:
[Trabalhado]
[Indenizado]
[Dispensado do cumprimento]
```

### Pedido de demissão + empregado dispensado de trabalhar

Exemplo:

```text
Empregado pede demissão.
Empregador dispensa o cumprimento do aviso.
```

Nesse caso não transformar automaticamente em:

```text
Aviso prévio indenizado pago ao empregado
```

O tratamento deve seguir a situação jurídica específica.

### Empregador dispensa o empregado de trabalhar durante aviso já concedido

Registrar como situação de aviso correspondente, sem simplesmente classificar tudo como "aviso indenizado".

O eSocial possui regras específicas para cumprimento parcial, dispensa e aviso prévio. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-05-2025-com-marcacoes.pdf).

---

# 8. Aviso misto

Suportar:

```text
Aviso total: 30 dias
Trabalhados: 10
Indenizados: 20
```

Fórmula:

```text
valor_indenizado =
remuneração_base / 30 × dias_indenizados
```

O eSocial orienta informar o aviso misto e os dias indenizados em rubrica própria. [Fonte oficial](https://www.gov.br/esocial/pt-br/empresas/manual-web-geral).

---

# 9. Data projetada do aviso

Criar os seguintes campos:

```text
data_desligamento
data_comunicacao_aviso
dias_aviso
dias_aviso_trabalhados
dias_aviso_indenizados
data_inicio_projecao
data_projetada_fim_aviso
```

A data projetada deve ser calculada pelo motor e armazenada.

Exemplo:

```text
Data comunicação: 21/09/2026
Aviso indenizado: 30 dias

Data de desligamento: 25/09/2026
Projeção aproximada do aviso: 25/10/2026
```

> O algoritmo deve ser implementado e testado com exemplos oficiais, considerando como a contagem de dias é tratada pelo evento eSocial.

---

# 10. Regra dos avos

Esta é uma das regras mais importantes do motor.

Para 13º e férias proporcionais, não usar:

```text
mês atual / 12
```

e nunca usar automaticamente:

```text
meses do ano = avos
```

Calcular com base no período trabalhado e, quando aplicável, na projeção do aviso.

A regra prática para 13º proporcional considera 1/12 para cada mês ou fração igual ou superior a 15 dias.

O sistema precisa considerar a projeção do aviso indenizado quando essa projeção gerar avo.

---

# 11. Cálculo de 13º proporcional

Fórmula:

```text
13_proporcional =
remuneracao_base_13 / 12 × quantidade_avos
```

Exemplo:

```text
Salário: R$ 6.500

1 avo:
6.500 / 12
= R$ 541,67

2 avos:
6.500 / 12 × 2
= R$ 1.083,33
```

Separar internamente:

```text
13_PROPORCIONAL
13_AVISO_PREVIO
```

Não misturar as duas rubricas.

---

# 12. Férias proporcionais

Fórmula:

```text
ferias_proporcionais =
remuneracao_base_ferias / 12 × quantidade_avos
```

Depois:

```text
terco_constitucional =
ferias_proporcionais / 3
```

Total:

```text
ferias_com_terco =
ferias_proporcionais + terco_constitucional
```

Exemplo:

```text
Salário: R$ 6.500
Avos: 2/12

Férias:
6.500 / 12 × 2
= R$ 1.083,33

1/3:
1.083,33 / 3
= R$ 361,11

Total:
R$ 1.444,44
```

---

# 13. Férias vencidas

O motor deve verificar se existem períodos aquisitivos completos não gozados.

Estrutura:

```text
periodo_aquisitivo
inicio
fim
dias_direito
dias_gozados
dias_vendidos
saldo
status
```

Na rescisão:

```text
se houver saldo de férias vencidas:
    calcular férias vencidas
    calcular 1/3
```

Se houver situações especiais de pagamento em dobro, não codificar como regra genérica sem validar a situação legal.

---

# 14. Saldo de salário

Regra padrão mensal:

```text
saldo_salario =
salario_base / 30 × dias_devidos_no_mes
```

Exemplo:

```text
Salário = R$ 6.500
Dias = 20

6.500 / 30 × 20
= R$ 4.333,33
```

Para jornadas ou remunerações específicas, o motor deve utilizar a remuneração aplicável ao trabalhador.

---

# 15. Médias e remuneração variável

Não calcular férias, 13º e aviso apenas com salário-base quando o trabalhador possui parcelas que integram a remuneração segundo as regras aplicáveis.

Criar mecanismo para médias de:

- Horas extras
- Adicional noturno
- Comissões
- Gratificações
- Adicionais
- Outras parcelas variáveis

Criar entidade:

```text
medias_rescisorias
------------------
colaborador_id
tipo_verba
periodo_inicio
periodo_fim
quantidade
valor_total
media_calculada
criterio
```

---

# 16. Regra por motivo + aviso

Criar uma matriz de regras.

| Motivo | Trabalhado | Indenizado | Dispensado | Misto |
|---|---|---|---|---|
| Sem justa causa empregador | SIM | SIM | conforme situação | SIM |
| Pedido de demissão | SIM | NÃO como verba paga pelo empregador ao empregado; pode haver desconto quando aviso não cumprido | SIM, conforme situação | conforme situação |
| Justa causa | NÃO | NÃO | NÃO | NÃO |
| Término contrato a termo | NÃO como aviso comum, salvo regra específica | NÃO como aviso comum | NÃO | NÃO |
| Acordo art. 484-A | SIM, conforme acordo | SIM, pela metade quando cabível | conforme situação | SIM |

> A matriz deve ser parametrizável. Não hardcode regras irreversíveis no frontend.

---

# 17. Verbas por motivo

## 17.1 Sem justa causa

Normalmente analisar:

```text
Saldo de salário
Aviso prévio
13º proporcional
13º sobre aviso, quando aplicável
Férias proporcionais
1/3 de férias
Férias vencidas, se existirem
1/3 de férias vencidas
Outras verbas
```

Além disso:

```text
FGTS rescisório
Multa FGTS 40%
```

A multa de FGTS deve ser tratada na área de encargos/rescisão, e não como parte do líquido comum pago em folha.

---

## 17.2 Pedido de demissão

Analisar:

```text
Saldo de salário
13º proporcional
Férias proporcionais
1/3 de férias
Férias vencidas, se existirem
Outras verbas
```

Pode existir:

```text
Desconto de aviso prévio
```

quando legalmente cabível.

Não gerar:

```text
Multa FGTS 40%
Aviso prévio indenizado pago pelo empregador
```

---

## 17.3 Justa causa

Normalmente analisar:

```text
Saldo de salário
Férias vencidas + 1/3, se existentes
Outras verbas legalmente cabíveis
```

Não gerar automaticamente:

```text
Aviso prévio
13º proporcional
Férias proporcionais
Multa FGTS 40%
```

A regra deve ser validada de acordo com a legislação vigente e o caso concreto.

---

## 17.4 Término normal de contrato a termo

Analisar:

```text
Saldo de salário
13º proporcional
Férias proporcionais + 1/3
Férias vencidas, se existirem
Outras verbas
```

Não tratar automaticamente como:

```text
Aviso prévio de contrato por prazo indeterminado
```

O eSocial diferencia claramente o término do contrato a termo da rescisão antecipada. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-02-2024/tabelas.html).

---

## 17.5 Acordo art. 484-A

Analisar:

```text
Saldo de salário
50% do aviso prévio indenizado, quando cabível
13º proporcional
13º sobre aviso, quando aplicável
Férias proporcionais
1/3 de férias
Férias vencidas + 1/3, se existentes
Outras verbas
```

FGTS:

```text
Multa = 20%
```

A legislação específica do acordo deve ser incorporada ao motor.

---

# 18. Contrato por prazo determinado

Criar no cadastro do contrato:

```text
tipo_contrato
data_inicio
data_fim_prevista
possui_clausula_assecuratoria
```

Regras:

### Término na data prevista

```text
motivo = 06
```

### Rescisão antecipada pelo empregador

```text
motivo = 03
```

### Rescisão antecipada pelo empregado

```text
motivo = 04
```

### Com cláusula assecuratória

Quando existir cláusula assecuratória do direito recíproco de rescisão antecipada, o tratamento pode migrar para as regras de contrato por prazo indeterminado, conforme a situação.

O eSocial documenta expressamente essa diferença. [Fonte oficial](https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-v.2.4.02-publicado.pdf).

---

# 19. FGTS

Separar completamente:

```text
FGTS mensal
FGTS da rescisão
FGTS sobre determinadas verbas
Indenização compensatória
```

O FGTS Digital utiliza:

```text
base_fins_rescisorios
+
bases de FGTS das verbas rescisórias aplicáveis
=
base para multa
```

Depois:

```text
multa = base_total × percentual
```

Percentuais básicos suportados:

```text
Sem justa causa → 40%
Acordo → 20%
```

O FGTS Digital informa que o histórico das bases para fins rescisórios deve ser recomposto e que o cálculo da indenização compensatória pode usar 20% ou 40%, conforme o motivo. [Fonte oficial](https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/manual-e-documentacao-tecnica/manual-de-orientacao-do-fgts-digital-versao-1-60-de-05-05-2026.pdf).

---

# 20. INSS

Não calcular INSS utilizando simplesmente:

```text
total_proventos × alíquota
```

Cada rubrica deve ter configuração de incidência.

Estrutura:

```text
rubricas
---------
codigo
nome
natureza
incide_inss
incide_irrf
incide_fgts
incide_13
tipo
```

Exemplo conceitual:

```text
SALDO_SALARIO
    INSS = SIM
    IRRF = SIM
    FGTS = SIM

AVISO_INDENIZADO
    INSS = conforme tabela vigente
    IRRF = conforme legislação
    FGTS = conforme tabela vigente

FERIAS_INDENIZADAS
    aplicar incidência conforme legislação vigente

13_SALARIO
    apuração previdenciária própria
```

Nunca inferir incidência apenas pelo nome da verba.

---

# 21. IRRF

O IRRF também deve ser calculado por natureza da verba.

Não utilizar:

```text
IRRF = total da rescisão × alíquota
```

Separar:

```text
rendimentos tributáveis
rendimentos isentos/não tributáveis
deduções
dependentes
pensão
previdência
13º
outras bases específicas
```

O aviso prévio indenizado e determinadas verbas indenizatórias possuem tratamento tributário diferente das verbas salariais. A Receita Federal possui orientação específica sobre rendimentos recebidos na demissão.

---

# 22. Rubricas

Criar um catálogo de rubricas.

Exemplo:

```text
SAL001  Saldo de salário
AVI001  Aviso prévio indenizado
AVI002  Aviso prévio indenizado — acordo 50%
13S001  13º proporcional
13S002  13º sobre aviso indenizado
FER001  Férias proporcionais
FER002  1/3 de férias proporcionais
FER003  Férias vencidas
FER004  1/3 férias vencidas
AVD001  Desconto aviso prévio — pedido de demissão
INS001  INSS sobre saldo
INS002  INSS sobre 13º
IRR001  IRRF
FGT001  FGTS rescisório
MUL001  Multa FGTS 40%
MUL002  Multa FGTS 20%
```

Cada rubrica deve possuir:

```text
id
codigo
nome
descricao
natureza
tipo
formula
incide_inss
incide_irrf
incide_fgts
incide_13
incide_ferias
ativo
vigencia_inicio
vigencia_fim
```

---

# 23. Motor de cálculo

Não implementar toda a lógica dentro do componente React.

Arquitetura recomendada:

```text
Frontend
   ↓
API / Serviço de Rescisão
   ↓
RescisaoEngine
   ↓
RuleEngine
   ↓
Rubricas
   ↓
Tributação
   ↓
FGTS
   ↓
Resultado
```

---

# 24. Entrada do motor

Exemplo:

```json
{
  "colaborador_id": "123",
  "data_admissao": "2026-09-06",
  "data_desligamento": "2026-09-25",
  "motivo": "SEM_JUSTA_CAUSA_EMPREGADOR",
  "tipo_aviso": "INDENIZADO",
  "salario_base": 6500.00,
  "tipo_contrato": "PRAZO_INDETERMINADO",
  "dependentes_ir": 0,
  "ferias_vencidas": [],
  "outras_verbas": []
}
```

---

# 25. Saída do motor

```json
{
  "rescisao": {
    "total_proventos": 0,
    "total_descontos": 0,
    "valor_liquido": 0
  },
  "verbas": [],
  "encargos": [],
  "aviso": {
    "dias": 30,
    "dias_trabalhados": 0,
    "dias_indenizados": 30,
    "data_projetada": null
  },
  "fgts": {
    "base": 0,
    "percentual_multa": 40,
    "multa": 0
  },
  "validacoes": [],
  "warnings": []
}
```

---

# 26. Pseudocódigo principal

```text
function calcularRescisao(entrada):

    validarContrato(entrada)

    motivo = determinarMotivo(entrada)
    regras = carregarRegras(motivo, entrada.tipo_contrato)

    aviso = calcularAviso(entrada, regras)

    remuneracao = calcularRemuneracaoRescisoria(entrada)

    verbas = []

    verbas += calcularSaldoSalario(entrada, remuneracao, regras)

    if regras.temAviso:
        verbas += calcularAviso(entrada, aviso, remuneracao)

    verbas += calcular13Proporcional(entrada, aviso, remuneracao, regras)

    verbas += calcularFeriasProporcionais(entrada, aviso, remuneracao, regras)

    verbas += calcularFeriasVencidas(entrada, remuneracao, regras)

    verbas += calcularOutrasVerbas(entrada)

    bases = calcularBasesTributarias(verbas)

    descontos = []

    descontos += calcularINSS(bases)
    descontos += calcularIRRF(bases)
    descontos += calcularDescontosContratuais(entrada)

    fgts = calcularFGTS(entrada, verbas, regras)

    totalProventos = somarProventos(verbas)
    totalDescontos = somarDescontos(descontos)
    liquido = totalProventos - totalDescontos

    return {
        verbas,
        descontos,
        fgts,
        totalProventos,
        totalDescontos,
        liquido,
        aviso
    }
```

---

# 27. Ordem de processamento

A ordem deve ser fixa:

```text
1. Validar vínculo
2. Validar datas
3. Determinar motivo
4. Determinar tipo de contrato
5. Determinar aviso
6. Calcular projeção do aviso
7. Determinar avos
8. Calcular saldo salário
9. Calcular aviso
10. Calcular 13º
11. Calcular férias
12. Calcular outras verbas
13. Montar bases INSS
14. Calcular INSS
15. Montar bases IRRF
16. Calcular IRRF
17. Calcular FGTS
18. Calcular multa FGTS
19. Calcular líquido
20. Gerar validações
21. Gerar memória de cálculo
```

---

# 28. Memória de cálculo

O usuário do RH precisa conseguir clicar em qualquer verba e visualizar:

```text
VERBA
Saldo de salário

Base:
R$ 6.500,00

Dias:
20

Fórmula:
6.500 / 30 × 20

Resultado:
R$ 4.333,33

Incidências:
INSS: Sim
IRRF: Sim
FGTS: Sim
```

Para aviso:

```text
VERBA
Aviso prévio indenizado

Salário:
R$ 6.500,00

Dias:
30

Fórmula:
6.500 / 30 × 30

Resultado:
R$ 6.500,00

Projeção:
25/10/2026
```

Isso é essencial para auditoria e suporte.

---

# 29. Não usar fórmulas mágicas

Evitar no código:

```javascript
if (motivo === "SEM_JUSTA_CAUSA") {
   valor = salario / 12 * 2;
}
```

Preferir:

```javascript
const avos = calcularAvos({
    dataAdmissao,
    dataDesligamento,
    dataProjetadaAviso,
    tipoVerba: "FERIAS"
});

const verba = calcularRubrica({
    rubrica: "FER001",
    base,
    avos
});
```

O agente deve construir funções reutilizáveis.

---

# 30. Datas

Criar serviço próprio:

```text
DateCalculationService
```

Funções:

```text
calcularDiasEntreDatas()
calcularDiasTrabalhadosMes()
calcularAnosCompletos()
calcularDiasAviso()
calcularDataProjetadaAviso()
calcularAvos13()
calcularAvosFerias()
```

Testar inclusive:

```text
28/02
29/02
ano bissexto
mudança de mês
mudança de ano
admissão no último dia do mês
desligamento no primeiro dia
contrato de experiência
```

---

# 31. Arredondamento

Definir uma política única.

Recomendação:

```text
- manter cálculos internos com precisão decimal adequada;
- arredondar valores monetários conforme a regra aplicável;
- evitar floats binários para dinheiro;
- usar NUMERIC/DECIMAL no banco;
- registrar o valor calculado e a fórmula.
```

No PostgreSQL:

```sql
numeric(18,2)
```

ou maior precisão intermediária quando necessária.

---

# 32. Banco de dados

Tabelas recomendadas:

```text
residucoes
rescisao_verbas
rescisao_descontos
rescisao_bases
rescisao_fgts
rescisao_memoria_calculo
rescisao_validacoes
rescisao_eventos
rubricas
regras_rescisao
regras_incidencia
tabelas_inss
tabelas_irrf
historico_salarios
historico_contratos
historico_jornadas
historico_ferias
historico_fgts
```

---

# 33. Versionamento das regras

Não deixar alíquotas e regras legais fixas no código.

Exemplo:

```text
tabela_inss
--------------
vigencia_inicio
vigencia_fim
faixa_inicio
faixa_fim
aliquota
parcela_deduzir
```

O mesmo para:

```text
tabela_irrf
rubricas
incidencias
regras_aviso
regras_ferias
regras_13
```

Assim o sistema poderá calcular períodos antigos sem perder a regra vigente na época.

---

# 34. Validações

Antes de calcular:

```text
CPF existe?
Colaborador existe?
Contrato está ativo?
Data de admissão válida?
Data de desligamento >= admissão?
Existe afastamento?
Existe férias?
Existe aviso?
Existe contrato a termo?
Contrato já terminou?
```

Exemplos:

```text
ERRO:
Data de desligamento anterior à admissão.

ERRO:
Contrato a termo encerrado após a data prevista sem justificativa.

ALERTA:
Existem férias pendentes.

ALERTA:
Existem documentos obrigatórios pendentes.

ALERTA:
Existe afastamento ativo.
```

---

# 35. Casos de teste obrigatórios

Criar testes automatizados para no mínimo:

### Caso A
Admissão 06/09/2026  
Salário R$ 6.500  
Demissão sem justa causa  
Desligamento 25/09/2026  
Aviso indenizado 30 dias.

### Caso B
Mesmo caso com aviso trabalhado.

### Caso C
Pedido de demissão com aviso trabalhado.

### Caso D
Pedido de demissão sem cumprimento do aviso, aplicando desconto quando cabível.

### Caso E
Pedido de demissão com dispensa do cumprimento pelo empregador.

### Caso F
Justa causa.

### Caso G
Contrato de experiência terminando na data prevista.

### Caso H
Contrato a termo encerrado antecipadamente pelo empregador.

### Caso I
Contrato a termo encerrado antecipadamente pelo empregado.

### Caso J
Acordo art. 484-A.

### Caso K
Acordo com aviso indenizado.

### Caso L
Sem justa causa com férias vencidas.

### Caso M
Sem justa causa com 1 ano de empresa e aviso de 33 dias.

### Caso N
Sem justa causa com vários anos de empresa e aviso proporcional.

### Caso O
Aviso misto.

### Caso P
Trabalhador com comissões/médias.

---

# 36. Caso de referência — R$ 6.500

Entrada:

```text
Admissão: 06/09/2026
Desligamento: 25/09/2026
Motivo: Sem justa causa pelo empregador
Aviso: Indenizado
Salário: R$ 6.500,00
```

Valores básicos esperados antes dos descontos:

```text
Saldo salário:
6.500 / 30 × 20
= R$ 4.333,33

Aviso:
6.500 / 30 × 30
= R$ 6.500,00

13º proporcional:
6.500 / 12 × 1
= R$ 541,67

13º sobre aviso:
6.500 / 12 × 1
= R$ 541,67

Férias proporcionais:
6.500 / 12 × 2
= R$ 1.083,33

1/3 férias:
1.083,33 / 3
= R$ 361,11
```

Total:

```text
R$ 13.361,11
```

O objetivo deste caso é testar a engine e a memória de cálculo.

**Não fixar os descontos deste exemplo como valor absoluto**, porque INSS, IRRF e outras incidências devem ser processados pelas tabelas e regras vigentes e pela composição efetiva das rubricas.

---

# 37. Interface de rescisão

## Passo 1 — Motivo

```text
Motivo do desligamento

( ) Sem justa causa pelo empregador
( ) Pedido de demissão
( ) Justa causa
( ) Término de contrato por prazo determinado
( ) Rescisão por acordo entre as partes
```

## Passo 2 — Datas

```text
Data de admissão:      06/09/2026
Data de comunicação:   21/09/2026
Data de desligamento:  25/09/2026
```

## Passo 3 — Aviso

Mostrar apenas opções compatíveis:

```text
Tipo:
[Trabalhado]
[Indenizado]
[Dispensado]
[Misto]
```

## Passo 4 — Resultado

```text
PROVENTOS

Saldo de salário             R$ XXXXX
Aviso prévio                 R$ XXXXX
13º proporcional             R$ XXXXX
13º sobre aviso              R$ XXXXX
Férias proporcionais         R$ XXXXX
1/3 férias                   R$ XXXXX

TOTAL PROVENTOS              R$ XXXXX


DESCONTOS

INSS                         R$ XXXXX
IRRF                         R$ XXXXX
Aviso descontado             R$ XXXXX
Outros                       R$ XXXXX

TOTAL DESCONTOS              R$ XXXXX

VALOR LÍQUIDO                R$ XXXXX
```

---

# 38. Área de encargos

Separar:

```text
FGTS da competência
FGTS rescisório
FGTS sobre aviso, quando aplicável
FGTS sobre 13º
Base para multa
Percentual da multa
Valor da multa
```

Não incluir a multa de FGTS automaticamente no:

```text
Valor líquido da rescisão
```

A multa é uma obrigação relacionada ao FGTS e deve ser apresentada separadamente.

---

# 39. Auditoria da rescisão

Toda rescisão calculada deve armazenar:

```text
usuario_id
data_calculo
versao_motor
versao_regras
motivo
tipo_aviso
entrada_json
resultado_json
```

Quando o cálculo for recalculado:

```text
versao 1
versao 2
versao 3
```

Nunca apagar o histórico sem uma regra explícita de retenção.

---

# 40. Regras de segurança

Somente usuários autorizados devem poder:

- Criar rescisão;
- Alterar motivo;
- Alterar salário;
- Alterar aviso;
- Recalcular;
- Aprovar;
- Finalizar;
- Cancelar;
- Exportar documentos.

Toda alteração após aprovação deve gerar:

```text
quem alterou
quando
campo alterado
valor anterior
valor novo
motivo
```

---

# 41. Fluxo recomendado

```text
COLABORADOR ATIVO
       ↓
INICIAR RESCISÃO
       ↓
SELECIONAR MOTIVO
       ↓
VALIDAR CONTRATO
       ↓
INFORMAR DATAS
       ↓
DETERMINAR AVISO
       ↓
CALCULAR PROJEÇÃO
       ↓
CALCULAR AVOS
       ↓
CALCULAR VERBAS
       ↓
CALCULAR INSS
       ↓
CALCULAR IRRF
       ↓
CALCULAR FGTS
       ↓
CALCULAR MULTA
       ↓
VALIDAR
       ↓
EXIBIR MEMÓRIA DE CÁLCULO
       ↓
REVISÃO DO RH
       ↓
APROVAÇÃO
       ↓
GERAR DOCUMENTOS
       ↓
REGISTRAR DESLIGAMENTO
       ↓
ENCERRAR VÍNCULO
```

---

# 42. Regra de ouro para o agente

O agente deve seguir esta regra:

> **Motivo define quais verbas podem existir. Tipo de aviso define como o aviso é calculado. Data e projeção definem os avos. Cada rubrica define suas próprias incidências tributárias e de FGTS. O motor nunca deve calcular impostos sobre o total bruto simplesmente aplicando uma alíquota.**

Em outras palavras:

```text
MOTIVO
   ↓
DIREITOS
   ↓
AVISO
   ↓
PROJEÇÃO
   ↓
AVOS
   ↓
RUBRICAS
   ↓
INCIDÊNCIAS
   ↓
INSS / IRRF / FGTS
   ↓
LÍQUIDO
```

Essa arquitetura deve ser seguida tanto no backend quanto na interface de memória de cálculo.

---

# 43. Critérios de aceite

A funcionalidade será considerada pronta somente quando:

- [ ] Os cinco motivos solicitados forem suportados;
- [ ] Aviso trabalhado for suportado;
- [ ] Aviso indenizado for suportado;
- [ ] Aviso dispensado for suportado;
- [ ] Aviso misto for suportado internamente;
- [ ] Contratos por prazo determinado forem tratados separadamente;
- [ ] Aviso proporcional for calculado corretamente;
- [ ] Projeção do aviso for registrada;
- [ ] 13º for calculado por avos;
- [ ] Férias forem calculadas por avos;
- [ ] Férias vencidas forem identificadas;
- [ ] Médias possam ser incorporadas;
- [ ] INSS seja calculado por base/rubrica;
- [ ] IRRF seja calculado por base/rubrica;
- [ ] FGTS seja calculado separadamente;
- [ ] Multa de FGTS seja calculada conforme o motivo;
- [ ] Pedido de demissão permita desconto de aviso quando cabível;
- [ ] Justa causa não gere automaticamente verbas indevidas;
- [ ] Acordo aplique regra de 50% do aviso indenizado quando cabível e 20% de multa FGTS;
- [ ] Memória de cálculo seja exibida;
- [ ] Regras tenham vigência;
- [ ] Cálculo seja auditável;
- [ ] Testes automatizados cubram os cenários principais;
- [ ] O resultado possa ser reproduzido utilizando a versão histórica das regras.

---

# 44. Observação jurídica

Este motor deve ser tratado como **software de apoio ao cálculo**, não como substituto da análise profissional.

A legislação trabalhista, regras do eSocial, FGTS Digital, INSS e Receita Federal podem sofrer alterações. O sistema precisa manter tabelas e regras versionadas.

Antes de utilizar os cálculos para pagamento real, a empresa deve validar o resultado com seu contador, departamento pessoal ou profissional especializado.
