# Diagnóstico e Parâmetros das Rubricas em Produção (T30 / Doc §5.3)

**Data da Consulta:** 2026-10-12T03:12:29.583Z
**Total de Rubricas no Banco:** 42

## 1. Tabela Geral de Parâmetros e Incidências

| Código | Nome | Tipo | Categoria | Ordem | Forma Cálculo | Base Cálculo | Fator | % | Divisor | Ativo | Gera INSS | Gera IRRF | Gera FGTS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 101 | Salário Base | EARNING | SALARY | 10 | FIXO | SALARIO_BASE | - | - | - | Sim | inc | inc | inc |
| 102 | Salário Proporcional | EARNING | SALARY | 10 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 103 | DSR | EARNING | SALARY | 10 | *nulo* | BASE_DSR | - | - | - | Sim | não | não | não |
| 104 | DSR sobre Variáveis | EARNING | SALARY | 45 | *nulo* | BASE_DSR | - | - | - | Sim | não | não | não |
| 105 | Salário Maternidade | EARNING | SALARY | 10 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 107 | Adicional de Função | EARNING | SALARY | 20 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 150 | Hora Extra 50% | EARNING | OVERTIME | 40 | HORAS | SALARIO_BASE | 1.5 | - | - | Sim | inc | inc | inc |
| 151 | Hora Extra 60% | EARNING | OVERTIME | 40 | *nulo* | SALARIO_BASE | 1.6 | - | - | Sim | não | não | não |
| 160 | Hora Extra 100% | EARNING | OVERTIME | 40 | HORAS | SALARIO_BASE | 2 | - | - | Sim | inc | inc | inc |
| 170 | DSR sobre Horas Extras | EARNING | OVERTIME | 45 | FORMULA | - | - | - | - | Sim | inc | inc | inc |
| 171 | DSR sobre Adic. Noturno | EARNING | DSR | 46 | *nulo* | BASE_DSR_NOTURNO | - | - | - | Sim | não | não | não |
| 201 | Vale Transporte | DEDUCTION | ALLOWANCE | 85 | MANUAL | - | - | - | - | Sim | não | não | não |
| 202 | Vale Refeição / Alimentação | DEDUCTION | ALLOWANCE | 85 | MANUAL | - | - | - | - | Sim | não | não | não |
| 203 | Plano Médico | DEDUCTION | ALLOWANCE | 85 | *nulo* | - | - | - | - | Sim | não | não | não |
| 204 | Plano Odontológico | DEDUCTION | ALLOWANCE | 85 | *nulo* | - | - | - | - | Sim | não | não | não |
| 250 | Adiantamento Quinzenal | EARNING | ADVANCE | 15 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 301 | Adicional Noturno | EARNING | OTHER | 20 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 302 | Adicional de Insalubridade | EARNING | OTHER | 20 | *nulo* | SALARIO_MINIMO | - | - | - | Sim | não | não | não |
| 303 | Adicional de Periculosidade | EARNING | OTHER | 20 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 304 | Adicional por Tempo de Serviço | EARNING | OTHER | 20 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 401 | Comissão | EARNING | OTHER | 30 | *nulo* | - | - | - | - | Sim | não | não | não |
| 402 | Gratificação | EARNING | OTHER | 30 | *nulo* | - | - | - | - | Sim | não | não | não |
| 403 | Prêmio | EARNING | OTHER | 30 | *nulo* | - | - | - | - | Sim | não | não | não |
| 404 | Participação nos Lucros/Resultados | EARNING | OTHER | 30 | *nulo* | - | - | - | - | Sim | não | não | não |
| 501 | Férias | EARNING | OTHER | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 502 | 1/3 Constitucional de Férias | EARNING | OTHER | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 503 | Abono Pecuniário | EARNING | OTHER | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 504 | 1/3 sobre Abono Pecuniário | EARNING | OTHER | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 508 | Desconto de Férias | DEDUCTION | OTHER | 50 | *nulo* | - | - | - | - | Sim | não | não | não |
| 601 | 13º Salário | EARNING | OTHER | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 602 | Adiantamento 13º | EARNING | ADVANCE | 50 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 608 | Desconto de Adiantamento 13º | DEDUCTION | ADVANCE | 50 | *nulo* | - | - | - | - | Sim | não | não | não |
| 701 | Saldo de Salário | EARNING | SALARY | 60 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 707 | Aviso Prévio Indenizado | EARNING | OTHER | 60 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 708 | Multa Rescisória FGTS | EARNING | OTHER | 60 | *nulo* | - | - | - | - | Sim | não | não | não |
| 801 | Faltas | DEDUCTION | OTHER | 80 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 802 | Atrasos | DEDUCTION | OTHER | 80 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 803 | DSR sobre Falta | DEDUCTION | OTHER | 80 | *nulo* | SALARIO_BASE | - | - | - | Sim | não | não | não |
| 850 | Desconto de Adiantamento | DEDUCTION | ADVANCE | 85 | *nulo* | - | - | - | - | Sim | não | não | não |
| 901 | Contribuição INSS | DEDUCTION | TAX | 90 | AUTOMATICA | - | - | - | - | Sim | não | não | não |
| 902 | IRRF Mensal | DEDUCTION | TAX | 95 | AUTOMATICA | - | - | - | - | Sim | não | não | não |
| 903 | FGTS Mensal (Depósito) | BASE | TAX | 50 | AUTOMATICA | - | - | - | - | Sim | não | não | não |

## 2. Rubricas Ativas com Forma de Cálculo NULA (Incompletas)

Foram encontradas **33** rubricas ativas sem forma de cálculo definida:

- **[102] Salário Proporcional** (Tipo: EARNING, Categoria: SALARY)
- **[103] DSR** (Tipo: EARNING, Categoria: SALARY)
- **[104] DSR sobre Variáveis** (Tipo: EARNING, Categoria: SALARY)
- **[105] Salário Maternidade** (Tipo: EARNING, Categoria: SALARY)
- **[107] Adicional de Função** (Tipo: EARNING, Categoria: SALARY)
- **[151] Hora Extra 60%** (Tipo: EARNING, Categoria: OVERTIME)
- **[171] DSR sobre Adic. Noturno** (Tipo: EARNING, Categoria: DSR)
- **[203] Plano Médico** (Tipo: DEDUCTION, Categoria: ALLOWANCE)
- **[204] Plano Odontológico** (Tipo: DEDUCTION, Categoria: ALLOWANCE)
- **[250] Adiantamento Quinzenal** (Tipo: EARNING, Categoria: ADVANCE)
- **[301] Adicional Noturno** (Tipo: EARNING, Categoria: OTHER)
- **[302] Adicional de Insalubridade** (Tipo: EARNING, Categoria: OTHER)
- **[303] Adicional de Periculosidade** (Tipo: EARNING, Categoria: OTHER)
- **[304] Adicional por Tempo de Serviço** (Tipo: EARNING, Categoria: OTHER)
- **[401] Comissão** (Tipo: EARNING, Categoria: OTHER)
- **[402] Gratificação** (Tipo: EARNING, Categoria: OTHER)
- **[403] Prêmio** (Tipo: EARNING, Categoria: OTHER)
- **[404] Participação nos Lucros/Resultados** (Tipo: EARNING, Categoria: OTHER)
- **[501] Férias** (Tipo: EARNING, Categoria: OTHER)
- **[502] 1/3 Constitucional de Férias** (Tipo: EARNING, Categoria: OTHER)
- **[503] Abono Pecuniário** (Tipo: EARNING, Categoria: OTHER)
- **[504] 1/3 sobre Abono Pecuniário** (Tipo: EARNING, Categoria: OTHER)
- **[508] Desconto de Férias** (Tipo: DEDUCTION, Categoria: OTHER)
- **[601] 13º Salário** (Tipo: EARNING, Categoria: OTHER)
- **[602] Adiantamento 13º** (Tipo: EARNING, Categoria: ADVANCE)
- **[608] Desconto de Adiantamento 13º** (Tipo: DEDUCTION, Categoria: ADVANCE)
- **[701] Saldo de Salário** (Tipo: EARNING, Categoria: SALARY)
- **[707] Aviso Prévio Indenizado** (Tipo: EARNING, Categoria: OTHER)
- **[708] Multa Rescisória FGTS** (Tipo: EARNING, Categoria: OTHER)
- **[801] Faltas** (Tipo: DEDUCTION, Categoria: OTHER)
- **[802] Atrasos** (Tipo: DEDUCTION, Categoria: OTHER)
- **[803] DSR sobre Falta** (Tipo: DEDUCTION, Categoria: OTHER)
- **[850] Desconto de Adiantamento** (Tipo: DEDUCTION, Categoria: ADVANCE)

## 3. Rubricas Ativas sem Nenhuma Incidência Configurada (INSS/IRRF/FGTS = false/null)

Total: **38** rubricas ativas sem incidência.

- **[102] Salário Proporcional** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[103] DSR** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[104] DSR sobre Variáveis** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[105] Salário Maternidade** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[107] Adicional de Função** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[151] Hora Extra 60%** (Tipo: EARNING, Categoria: OVERTIME, Forma: nulo)
- **[171] DSR sobre Adic. Noturno** (Tipo: EARNING, Categoria: DSR, Forma: nulo)
- **[201] Vale Transporte** (Tipo: DEDUCTION, Categoria: ALLOWANCE, Forma: MANUAL)
- **[202] Vale Refeição / Alimentação** (Tipo: DEDUCTION, Categoria: ALLOWANCE, Forma: MANUAL)
- **[203] Plano Médico** (Tipo: DEDUCTION, Categoria: ALLOWANCE, Forma: nulo)
- **[204] Plano Odontológico** (Tipo: DEDUCTION, Categoria: ALLOWANCE, Forma: nulo)
- **[250] Adiantamento Quinzenal** (Tipo: EARNING, Categoria: ADVANCE, Forma: nulo)
- **[301] Adicional Noturno** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[302] Adicional de Insalubridade** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[303] Adicional de Periculosidade** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[304] Adicional por Tempo de Serviço** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[401] Comissão** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[402] Gratificação** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[403] Prêmio** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[404] Participação nos Lucros/Resultados** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[501] Férias** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[502] 1/3 Constitucional de Férias** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[503] Abono Pecuniário** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[504] 1/3 sobre Abono Pecuniário** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[508] Desconto de Férias** (Tipo: DEDUCTION, Categoria: OTHER, Forma: nulo)
- **[601] 13º Salário** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[602] Adiantamento 13º** (Tipo: EARNING, Categoria: ADVANCE, Forma: nulo)
- **[608] Desconto de Adiantamento 13º** (Tipo: DEDUCTION, Categoria: ADVANCE, Forma: nulo)
- **[701] Saldo de Salário** (Tipo: EARNING, Categoria: SALARY, Forma: nulo)
- **[707] Aviso Prévio Indenizado** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[708] Multa Rescisória FGTS** (Tipo: EARNING, Categoria: OTHER, Forma: nulo)
- **[801] Faltas** (Tipo: DEDUCTION, Categoria: OTHER, Forma: nulo)
- **[802] Atrasos** (Tipo: DEDUCTION, Categoria: OTHER, Forma: nulo)
- **[803] DSR sobre Falta** (Tipo: DEDUCTION, Categoria: OTHER, Forma: nulo)
- **[850] Desconto de Adiantamento** (Tipo: DEDUCTION, Categoria: ADVANCE, Forma: nulo)
- **[901] Contribuição INSS** (Tipo: DEDUCTION, Categoria: TAX, Forma: AUTOMATICA)
- **[902] IRRF Mensal** (Tipo: DEDUCTION, Categoria: TAX, Forma: AUTOMATICA)
- **[903] FGTS Mensal (Depósito)** (Tipo: BASE, Categoria: TAX, Forma: AUTOMATICA)

## 4. Análise de Duplicidades e Conflitos

### DSR (Descanso Semanal Remunerado):
- **[103] DSR**: Ativo=true, Forma=null, Categoria=SALARY
- **[104] DSR sobre Variáveis**: Ativo=true, Forma=null, Categoria=SALARY
- **[171] DSR sobre Adic. Noturno**: Ativo=true, Forma=null, Categoria=DSR
