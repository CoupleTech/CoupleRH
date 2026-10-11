# Relatório de Verificação do Banco de Dados (Produção)
**Data de Execução:** 2026-10-11T21:46:05.963Z  
**Ambiente:** Supabase PostgreSQL (https://wcvgpnmaryumfcfwyrrj.supabase.co)  
**Referência:** `DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md` - Anexo A (Fase P0)

---

## 1. Catálogo de Rubricas (`payroll_rubrics`)
Total de rubricas encontradas: **42**

| Código | Nome | Tipo | Categoria | Forma Cálculo | Base | Fator | % | Divisor | Fórmula | Ordem | Ativa |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 101 | Salário Base | EARNING | SALARY | FIXO | SALARIO_BASE | - | - | - | - | 10 | Sim |
| 102 | Salário Proporcional | EARNING | SALARY | - | SALARIO_BASE | - | - | - | - | 10 | Sim |
| 103 | DSR | EARNING | SALARY | - | BASE_DSR | - | - | - | - | 10 | Sim |
| 104 | DSR sobre Variáveis | EARNING | SALARY | - | BASE_DSR | - | - | - | - | 45 | Sim |
| 105 | Salário Maternidade | EARNING | SALARY | - | SALARIO_BASE | - | - | - | - | 10 | Sim |
| 107 | Adicional de Função | EARNING | SALARY | - | SALARIO_BASE | - | - | - | - | 20 | Sim |
| 150 | Hora Extra 50% | EARNING | OVERTIME | HORAS | SALARIO_BASE | 1.5 | - | - | - | 40 | Sim |
| 151 | Hora Extra 60% | EARNING | OVERTIME | - | SALARIO_BASE | 1.6 | - | - | - | 40 | Sim |
| 160 | Hora Extra 100% | EARNING | OVERTIME | HORAS | SALARIO_BASE | 2 | - | - | - | 40 | Sim |
| 170 | DSR sobre Horas Extras | EARNING | OVERTIME | FORMULA | - | - | - | - | `(BASE_DSR / DIAS_UTEIS) * DIAS_INUTEIS` | 45 | Sim |
| 171 | DSR sobre Adic. Noturno | EARNING | DSR | - | BASE_DSR_NOTURNO | - | - | - | - | 46 | Sim |
| 201 | Vale Transporte | DEDUCTION | ALLOWANCE | MANUAL | - | - | - | - | - | 85 | Sim |
| 202 | Vale Refeição / Alimentação | DEDUCTION | ALLOWANCE | MANUAL | - | - | - | - | - | 85 | Sim |
| 203 | Plano Médico | DEDUCTION | ALLOWANCE | - | - | - | - | - | - | 85 | Sim |
| 204 | Plano Odontológico | DEDUCTION | ALLOWANCE | - | - | - | - | - | - | 85 | Sim |
| 250 | Adiantamento Quinzenal | EARNING | ADVANCE | - | SALARIO_BASE | - | - | - | - | 15 | Sim |
| 301 | Adicional Noturno | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 20 | Sim |
| 302 | Adicional de Insalubridade | EARNING | OTHER | - | SALARIO_MINIMO | - | - | - | - | 20 | Sim |
| 303 | Adicional de Periculosidade | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 20 | Sim |
| 304 | Adicional por Tempo de Serviço | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 20 | Sim |
| 401 | Comissão | EARNING | OTHER | - | - | - | - | - | - | 30 | Sim |
| 402 | Gratificação | EARNING | OTHER | - | - | - | - | - | - | 30 | Sim |
| 403 | Prêmio | EARNING | OTHER | - | - | - | - | - | - | 30 | Sim |
| 404 | Participação nos Lucros/Resultados | EARNING | OTHER | - | - | - | - | - | - | 30 | Sim |
| 501 | Férias | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 502 | 1/3 Constitucional de Férias | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 503 | Abono Pecuniário | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 504 | 1/3 sobre Abono Pecuniário | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 508 | Desconto de Férias | DEDUCTION | OTHER | - | - | - | - | - | - | 50 | Sim |
| 601 | 13º Salário | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 602 | Adiantamento 13º | EARNING | ADVANCE | - | SALARIO_BASE | - | - | - | - | 50 | Sim |
| 608 | Desconto de Adiantamento 13º | DEDUCTION | ADVANCE | - | - | - | - | - | - | 50 | Sim |
| 701 | Saldo de Salário | EARNING | SALARY | - | SALARIO_BASE | - | - | - | - | 60 | Sim |
| 707 | Aviso Prévio Indenizado | EARNING | OTHER | - | SALARIO_BASE | - | - | - | - | 60 | Sim |
| 708 | Multa Rescisória FGTS | EARNING | OTHER | - | - | - | - | - | - | 60 | Sim |
| 801 | Faltas | DEDUCTION | OTHER | - | SALARIO_BASE | - | - | - | - | 80 | Sim |
| 802 | Atrasos | DEDUCTION | OTHER | - | SALARIO_BASE | - | - | - | - | 80 | Sim |
| 803 | DSR sobre Falta | DEDUCTION | OTHER | - | SALARIO_BASE | - | - | - | - | 80 | Sim |
| 850 | Desconto de Adiantamento | DEDUCTION | ADVANCE | - | - | - | - | - | - | 85 | Sim |
| 901 | Contribuição INSS | DEDUCTION | TAX | AUTOMATICA | - | - | - | - | - | 90 | Sim |
| 902 | IRRF Mensal | DEDUCTION | TAX | AUTOMATICA | - | - | - | - | - | 95 | Sim |
| 903 | FGTS Mensal (Depósito) | BASE | TAX | AUTOMATICA | - | - | - | - | - | 50 | Sim |

---

## 2. Versões Legais Vigentes (`legal_versions`)
Total de versões cadastradas: **1**

| ID | Nome / Descrição | Vigência Início | Vigência Fim | Criado em |
|---|---|---|---|---|
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | - | 2026-01-01 | Em vigor | 2026-09-17T16:16:51.140659+00:00 |

---

## 3. Parâmetros INSS (`inss_parameters`)
Total de faixas: **4**

| Versão ID | Faixa | Limite Base (R$) | Alíquota (%) |
|---|---|---|---|
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 1 | 1.621,00 | 7.5% |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 2 | 2.902,84 | 9% |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 3 | 4.354,27 | 12% |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 4 | 8.475,55 | 14% |

---

## 4. Parâmetros IRRF (`irrf_parameters`)
Total de faixas: **5**

| Versão ID | Faixa | Limite Base (R$) | Alíquota (%) | Dedução (R$) |
|---|---|---|---|---|
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 1 | 2.428,80 | 0% | 0,00 |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 2 | 2.826,65 | 7.5% | 182,16 |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 3 | 3.751,05 | 15% | 394,16 |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 4 | 4.664,68 | 22.5% | 675,49 |
| `37a07bce-ba56-462d-8ae6-560f8eba137c` | 5 | Sem teto | 27.5% | 908,73 |

---

## 5. Parâmetros Gerais Legais (`general_legal_parameters`)

- **Salário Mínimo:** R$ 1.621,00
- **Dedução por Dependente:** R$ 189,59
- **Desconto Simplificado IRRF:** R$ 0,00
- **Teto Salário Família:** R$ 0,00
- **Valor Salário Família:** R$ 0,00

---

## 6. Auditoria de Holerites Zerados (`payslips` com total = 0 e net = 0 em status CALCULATED)
Total encontrado: **0**

✅ **Nenhum holerite zerado em status CALCULATED.**

---

## 7. Invariante: Holerites com Itens Divergentes dos Totais do Cabeçalho
Total de divergências encontradas: **0**

✅ **Todos os holerites fecham perfeitamente: soma dos itens = totais do cabeçalho.**

---

## 8. Recibos Fictícios do eSocial (`receipt_number LIKE '1.2.000%'`)
Total encontrado: **0**

✅ **Nenhum recibo fictício remanescente com padrão 1.2.000%.**

---

## 9. Status das RPCs de Assinatura
- **`sign_worker_document`**: Revogada via migration `00067_revoke_sign_worker_document.sql` (T27). Substituição oficial prevista para Edge Function `sign-document` na Fase P6 (AS-04).
- **`get_worker_signatures`**: Mantida para consulta de histórico enquanto o novo modelo de assinaturas é estruturado.
