# Especificação de API

- O backend será guiado prioritariamente pelas APIs autogeradas do **Supabase / PostgREST**.
- Apenas regras sensíveis (Fechamento de Folha, Assinatura Eletrônica, Cálculo de Férias) não passarão pelas operações CRUD padrão do PostgREST. Estas rotas ficarão sob **Edge Functions (Deno/TypeScript)** ou Server-Actions do frontend.
- Filtros serão estritamente controlados via SDK (`supabase-js`) e a segurança garantida pelo RLS no banco de dados.

## Boas Práticas
- Nenhuma API deve retornar salários sem que o RLS certifique o escopo de acesso (`dp_analyst` ou próprio titular).
- Padrões de Retorno de Erros no Edge Functions devem respeitar código, correlation ID e ocultação de detalhes do banco.
