# Plano de Qualidade e Testes (QA/Test Plan)

A pirâmide de testes do projeto será invertida no domínio da folha de pagamento: a prioridade absoluta são os Testes Unitários de cálculo e os "Golden Tests".

## Tipos de Testes Obrigatórios
1. **Testes do Motor de Regras**:
   - Isolamento de cada Rubrica (com mocks limpos).
   - Teste de limites (anos bissextos, meses de 28 a 31 dias, mudanças de tabela de IRRF/INSS no meio do mês).
2. **Golden Tests de Folha**:
   - Massa de dados sintética ("golden records") onde o input A produz exatamente o resultado B (sem falha de arredondamento).
   - Se o motor mudar o resultado de um Golden Test, o CI de build deverá **quebrar**, exigindo intervenção humana para justificar a mudança normativa ou consertar a regressão.
3. **Testes de Isolamento Multiempresa (Tenancy)**:
   - Queries automatizadas testando o bypass do RLS (usando accounts de usuários simulados para tentar invadir o tenant vizinho, verificando a negação no nível do PostgreSQL).
4. **Testes de Segurança (SAST/DAST)**:
   - Configurados via pipeline CI/CD na Vercel / GitHub Actions.
