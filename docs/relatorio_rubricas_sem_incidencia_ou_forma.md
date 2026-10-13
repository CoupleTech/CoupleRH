# Relatório de Auditoria: Rubricas Ativas sem Forma de Cálculo ou Incidências (Fase P2 / Gate)

**Data de Execução:** 2026-10-13T03:21:40.972Z
**Total de Rubricas Cadastradas:** 49
**Total de Rubricas Ativas:** 48

## 1. Rubricas Ativas sem Forma de Cálculo

✅ **NENHUMA**. 100% das 48 rubricas ativas possuem forma de cálculo parametrizada.

## 2. Rubricas de Provento Tributável com Incidências Ausentes

✅ **NENHUMA**. Todos os proventos tributáveis (salários, horas extras, adicionais, comissões, férias e saldo de salário) possuem suas incidências legais configuradas conforme a matriz do Doc §5.2.

## 3. Catálogo Completo de Rubricas Ativas em Produção (Pós-Migration 00069)

| Código | Nome | Tipo | Categoria | Forma | Ordem | Base | Fator | INSS | IRRF | FGTS |
|---|---|---|---|---|---|---|---|---|---|---|
| 101 | Salário Base | EARNING | SALARY | FIXO | 10 | SALARIO_BASE | - | Sim | Sim | Sim |
| 102 | Salário Proporcional | EARNING | SALARY | DIAS | 10 | SALARIO_BASE | - | Sim | Sim | Sim |
| 104 | DSR sobre Variáveis | EARNING | SALARY | PERCENTUAL | 45 | BASE_DSR | - | Sim | Sim | Sim |
| 105 | Salário Maternidade | EARNING | SALARY | DIAS | 10 | SALARIO_BASE | - | Sim | Sim | Sim |
| 106 | Salário Família | EARNING | SALARY | AUTOMATICA | 10 | - | - | Não | Não | Não |
| 107 | Adicional de Função | EARNING | SALARY | PERCENTUAL | 20 | SALARIO_BASE | - | Sim | Sim | Sim |
| 150 | Hora Extra 50% | EARNING | OVERTIME | HORAS | 40 | SALARIO_BASE | 1.5 | Sim | Sim | Sim |
| 151 | Hora Extra 60% | EARNING | OVERTIME | HORAS | 40 | SALARIO_BASE | 1.6 | Sim | Sim | Sim |
| 152 | Banco de Horas (Crédito) | EARNING | OVERTIME | HORAS | 40 | SALARIO_BASE | 1.5 | Sim | Sim | Sim |
| 153 | Hora Extra 70% | EARNING | OVERTIME | HORAS | 40 | SALARIO_BASE | 1.7 | Sim | Sim | Sim |
| 160 | Hora Extra 100% | EARNING | OVERTIME | HORAS | 40 | SALARIO_BASE | 2 | Sim | Sim | Sim |
| 170 | DSR sobre Horas Extras | EARNING | OVERTIME | PERCENTUAL | 45 | BASE_DSR | - | Sim | Sim | Sim |
| 171 | DSR sobre Adic. Noturno | EARNING | DSR | PERCENTUAL | 46 | BASE_DSR_NOTURNO | - | Sim | Sim | Sim |
| 201 | Vale Transporte | DEDUCTION | ALLOWANCE | MANUAL | 85 | - | - | Não | Não | Não |
| 202 | Vale Refeição / Alimentação | DEDUCTION | ALLOWANCE | MANUAL | 85 | - | - | Não | Não | Não |
| 203 | Plano Médico | DEDUCTION | ALLOWANCE | MANUAL | 85 | - | - | Não | Não | Não |
| 204 | Plano Odontológico | DEDUCTION | ALLOWANCE | MANUAL | 85 | - | - | Não | Não | Não |
| 250 | Adiantamento Quinzenal | EARNING | ADVANCE | PERCENTUAL | 15 | SALARIO_BASE | - | Não | Não | Não |
| 301 | Adicional Noturno | EARNING | OTHER | HORAS | 20 | SALARIO_BASE | 0.2 | Sim | Sim | Sim |
| 302 | Adicional de Insalubridade | EARNING | OTHER | PERCENTUAL | 20 | SALARIO_MINIMO | - | Sim | Sim | Sim |
| 303 | Adicional de Periculosidade | EARNING | OTHER | PERCENTUAL | 20 | SALARIO_BASE | - | Sim | Sim | Sim |
| 304 | Adicional por Tempo de Serviço | EARNING | OTHER | PERCENTUAL | 20 | SALARIO_BASE | - | Sim | Sim | Sim |
| 305 | Adicional de Penosidade | EARNING | ALLOWANCE | PERCENTUAL | 20 | SALARIO_BASE | - | Sim | Sim | Sim |
| 401 | Comissão | EARNING | OTHER | MANUAL | 30 | - | - | Sim | Sim | Sim |
| 402 | Gratificação | EARNING | OTHER | MANUAL | 30 | - | - | Sim | Sim | Sim |
| 403 | Prêmio | EARNING | OTHER | MANUAL | 30 | - | - | Não | Não | Não |
| 404 | Participação nos Lucros/Resultados | EARNING | OTHER | MANUAL | 30 | - | - | Não | Sim | Não |
| 501 | Férias | EARNING | OTHER | DIAS | 50 | SALARIO_BASE | - | Sim | Sim | Sim |
| 502 | 1/3 Constitucional de Férias | EARNING | OTHER | FORMULA | 50 | SALARIO_BASE | - | Sim | Sim | Sim |
| 503 | Abono Pecuniário | EARNING | OTHER | DIAS | 50 | SALARIO_BASE | - | Não | Não | Não |
| 504 | 1/3 sobre Abono Pecuniário | EARNING | OTHER | FORMULA | 50 | SALARIO_BASE | - | Não | Não | Não |
| 508 | Desconto de Férias | DEDUCTION | OTHER | MANUAL | 50 | - | - | Não | Não | Não |
| 601 | 13º Salário | EARNING | OTHER | AVOS | 50 | SALARIO_BASE | - | Sim | Sim | Sim |
| 602 | Adiantamento 13º | EARNING | ADVANCE | AVOS | 50 | SALARIO_BASE | - | Não | Não | Sim |
| 608 | Desconto de Adiantamento 13º | DEDUCTION | ADVANCE | MANUAL | 50 | - | - | Não | Não | Não |
| 701 | Saldo de Salário | EARNING | SALARY | DIAS | 60 | SALARIO_BASE | - | Sim | Sim | Sim |
| 707 | Aviso Prévio Indenizado | EARNING | OTHER | DIAS | 60 | SALARIO_BASE | - | Não | Não | Sim |
| 708 | Multa Rescisória FGTS | EARNING | OTHER | PERCENTUAL | 60 | - | - | Não | Não | Não |
| 801 | Faltas | DEDUCTION | OTHER | DIAS | 80 | SALARIO_BASE | - | Sim | Sim | Sim |
| 802 | Atrasos | DEDUCTION | OTHER | HORAS | 80 | SALARIO_BASE | - | Sim | Sim | Sim |
| 803 | DSR sobre Falta | DEDUCTION | OTHER | DIAS | 80 | SALARIO_BASE | - | Sim | Sim | Sim |
| 804 | Pensão Alimentícia | DEDUCTION | OTHER | MANUAL | 85 | - | - | Não | Não | Não |
| 805 | Empréstimo Consignado | DEDUCTION | OTHER | MANUAL | 85 | - | - | Não | Não | Não |
| 806 | Contribuição Sindical / Assistencial | DEDUCTION | OTHER | MANUAL | 85 | - | - | Não | Não | Não |
| 850 | Desconto de Adiantamento | DEDUCTION | ADVANCE | MANUAL | 85 | - | - | Não | Não | Não |
| 901 | Contribuição INSS | DEDUCTION | TAX | AUTOMATICA | 90 | - | - | Não | Não | Não |
| 902 | IRRF Mensal | DEDUCTION | TAX | AUTOMATICA | 95 | - | - | Não | Não | Não |
| 903 | FGTS Mensal (Depósito) | BASE | TAX | AUTOMATICA | 50 | - | - | Não | Não | Não |
