# Modelo de Domínio (Domain Model)

As entidades centrais foram estritamente isoladas conforme a seção 5 do Prompt Mestre.

1. **`tenant`**: A Conta ou Licença primária do sistema (ex: Contabilidade ou Grupo Empresarial).
2. **`company`**: Empresa empregadora que assina a carteira de trabalho (CNPJ base).
3. **`establishment`**: Filial da empresa (CNPJ completo, endereço, lotação eSocial).
4. **`person` (Pessoa Física)**: A identidade civil de um ser humano (Nome civil, CPF, RG, Nascimento, Endereço).
5. **`worker` / `employee` (Trabalhador)**: Associação da pessoa física com um `tenant`.
6. **`employment_contract` (Vínculo/Contrato)**: O vínculo legal entre o Trabalhador e uma Empresa (`company`). Pode haver múltiplos contratos encerrados e ativos para a mesma pessoa civil no mesmo Tenant.

### Domínio de Folha (Motor)
1. **`payroll_period`**: Competência (Mês/Ano) e estado (Aberta, Em cálculo, Fechada).
2. **`payroll_category` / `rubric`**: Verbas de vencimento, desconto e base.
3. **`payroll_record` / `payslip`**: Registro que consolida as rubricas calculadas para aquele vínculo no período.
