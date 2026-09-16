# Threat Model e Segurança

### Principais Ameaças Mapeadas

1. **Vazamento de dados médicos (CID)**
   - *Vetor*: Gestor com acesso ao prontuário do colaborador.
   - *Mitigação*: View e política de RLS específica para tabelas de `health_records`, acessível apenas ao titular e a `sst_specialist`.

2. **Cross-Tenant Data Leak (Isolamento Multiempresa Falho)**
   - *Vetor*: Analista de DP da empresa "A" manipula ID da URL para ver folha da empresa "B".
   - *Mitigação*: Uso mandatório do Row Level Security (RLS) associado ao token JWT emitido pelo Supabase Auth. Nenhum filtro client-side é considerado seguro.

3. **Injeção de Fórmulas Matemáticas na Folha**
   - *Vetor*: `eval()` de fórmulas maliciosas cadastradas por admin.
   - *Mitigação*: Proibido executar strings como código. Uso estrito de bibliotecas de parse matemático isolado (ex: `mathjs` em sandbox) ou AST própria limitando variáveis disponíveis.

4. **Modificação Silenciosa de Folha ou Ponto**
   - *Vetor*: Alteração direta do valor do banco.
   - *Mitigação*: Trigger de banco obrigatório (`audit_trigger`) criando um append-only log inalterável de TODAS as transações nas tabelas operacionais.
