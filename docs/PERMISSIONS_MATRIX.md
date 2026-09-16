# Matriz de Permissões (RBAC) e RLS

## Níveis de Segregação
1. **Sistema Isolado (Tenants)**: Isolamento macro entre clientes (SaaS).
2. **Empresa e Estabelecimento**: Isolamento micro (matriz e filiais).
3. **Roles e Escopo**: Menor privilégio possível.

## Perfis Iniciais (Roles)
- **`system_admin`**: Acesso à administração global do SaaS.
- **`tenant_admin`**: Administrador mestre da conta contratante.
- **`dp_analyst`**: Acesso total às operações de DP (Folha, Férias, Rescisão, Ponto).
- **`manager` (Gestor)**: Apenas acesso à visualização da própria equipe. Aprovação de ponto, férias, HE. Sem acesso a salários, CID médico, e verbas da folha, exceto as pertinentes ao custo do setor.
- **`employee` (Trabalhador)**: Acesso exclusivo ao seu próprio prontuário 360º. Visualização de ponto, holerite e benefícios.
- **`sst_specialist`**: Acesso a PGR, PCMSO e envio de CAT/Atestados.
- **`auditor`**: Somente leitura (`read-only`) para consultas legais/fiscais e logs.
