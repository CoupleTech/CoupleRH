# Arquitetura (Architecture)

**Padrão Arquitetural**: Monólito Modular (para forte consistência transacional e facilidade de rastreabilidade).

A aplicação utiliza Supabase (PostgreSQL + Auth + Storage) como backend as a service, e React (Vite) no frontend. 
As regras de negócios governamentais e de cálculo da folha residem estruturalmente no PostgreSQL e, no futuro, serão processadas via Edge Functions TypeScript de forma isolada (Node.js).

### Decisões Arquiteturais Chave (ADRs base)

1. **Tenancy (Multilocação)**:
   - Abordagem: Pool logicamente isolado.
   - Implementação: Coluna `tenant_id` em todas as tabelas operacionais.
   - Proteção: `Row Level Security (RLS)` ativado em 100% das tabelas base, garantindo que o PostgreSQL impeça cruzamento de dados.

2. **Auditoria e Rastreabilidade (Audit Log)**:
   - Abordagem: Trigger baseada no banco de dados.
   - Implementação: Uma tabela `audit.audit_logs` e função trigger associada a toda tabela crítica. Não dependemos do backend/frontend para salvar logs; se o banco mudar, a trigger grava o `before` e `after`.

3. **Histórico Temporal (SCD Type 2)**:
   - Abordagem: Slowly Changing Dimensions para isolar as condições do passado.
   - Implementação: A tabela `employment_contract_history` utiliza colunas `valid_from` e `valid_to`. Uma alteração de salário encerra a vigência antiga (setando `valid_to`) e cria uma nova linha. O motor de cálculo de folha sempre busca o salário com `valid_from <= data_folha AND (valid_to IS NULL OR valid_to >= data_folha)`.

4. **Ponto Eletrônico e Portaria 671**:
   - Abordagem: Imutabilidade absoluta do dado de origem (Log-only).
   - Implementação: A tabela `time_entries` registra a batida bruta do relógio/app. É protegida por uma Rule SQL (`DO INSTEAD NOTHING` no `DELETE`). Qualquer ajuste manual do RH é gravado separadamente na tabela `time_entry_adjustments`.

5. **Motor de Fórmulas e Memória de Cálculo**:
   - Abordagem: Zero Execução de Código Dinâmico (`eval()` proibido).
   - Implementação: As fórmulas (Rubricas) são interpretadas via AST (Abstract Syntax Tree). O resultado é armazenado em `payroll_events`, e a memória detalhada é congelada via JSON em `payroll_memory_calc` (contendo todas as variáveis e a versão exata da regra no milissegundo do processamento).

6. **Storage Seguro**:
   - Documentos Admissionais, Contratos e Atestados Médicos (ASO) são salvos em Buckets privados no Supabase Storage. O acesso se dá exclusivamente por URLs assinadas (Signed URLs) com expiração rápida.

7. **eSocial e Mensageria (Assíncrono)**:
   - A tabela `esocial_transmissions` serve de Fila de Estado (Outbox Pattern). O sistema grava o payload XML nessa tabela com status `DRAFT` ou `QUEUED`. Um worker processará as assinaturas digitais via certificado A1 e envio ao SERPRO.
