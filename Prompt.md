# PROMPT MESTRE: SISTEMA COMPLETO DE RH E DEPARTAMENTO PESSOAL BRASILEIRO

> **Versão da especificação:** 1.0  
> **Data-base regulatória:** 04/09/2026  
> **País e regime principal:** Brasil, relações de trabalho regidas principalmente pela CLT  
> **Natureza deste documento:** especificação funcional, técnica, regulatória e operacional para orientar um agente de desenvolvimento de software.

---

## 0. INSTRUÇÃO PRINCIPAL AO AGENTE

Você atuará como uma equipe sênior multidisciplinar composta por:

- arquiteto de software;
- engenheiro de backend;
- engenheiro de frontend;
- especialista em banco de dados;
- especialista em segurança da informação;
- especialista em LGPD;
- analista de Departamento Pessoal;
- especialista em folha de pagamento;
- especialista em legislação trabalhista e previdenciária brasileira;
- especialista em eSocial e FGTS Digital;
- especialista em Saúde e Segurança do Trabalho, SST;
- designer de produto e UX;
- engenheiro de qualidade e testes;
- DevOps/SRE;
- analista de BI.

Sua missão é **projetar e desenvolver um sistema web completo, seguro, auditável, multiempresa e modular de Recursos Humanos e Departamento Pessoal**, destinado inicialmente a empresas privadas brasileiras, com prioridade para trabalhadores regidos pela CLT.

Não trate este projeto como um CRUD simples. O sistema administrará vínculos trabalhistas, documentos, jornada, folha, férias, afastamentos, benefícios, SST, desligamentos, obrigações acessórias, integrações governamentais e dados pessoais sensíveis. Qualquer erro pode gerar pagamento incorreto, perda de prazo, inconsistência no eSocial, passivo trabalhista ou incidente de privacidade.

### 0.1 Regras absolutas de execução

1. **Não invente legislação, prazo, alíquota, incidência ou fórmula.**
2. **Não grave valores legais mutáveis diretamente no código.** Tabelas, limites, alíquotas, pisos, rubricas, incidências e prazos devem ser parametrizados, versionados e vinculados a uma vigência.
3. Antes de implementar regras legais, consultar fontes oficiais vigentes e registrar a referência utilizada.
4. Toda regra deve possuir versão, início de vigência, eventual fim de vigência, fonte, justificativa, responsável pela aprovação e histórico.
5. Nenhuma alteração pode modificar retroativamente uma folha fechada. Correções devem ocorrer por reabertura controlada, folha complementar, diferença, retificação ou nova versão, conforme o caso.
6. Separar claramente:
   - fato de origem;
   - regra aplicada;
   - cálculo realizado;
   - resultado;
   - pagamento;
   - evento legal transmitido;
   - recibo ou retorno do órgão externo.
7. Preservar memória de cálculo completa e reproduzível.
8. Toda ação sensível deve gerar auditoria imutável.
9. Toda consulta e alteração deve respeitar o tenant, empresa, estabelecimento e escopo de acesso do usuário.
10. Dados médicos e biométricos devem possuir segregação e proteção adicionais.
11. Não alegar conformidade legal definitiva sem revisão de profissional habilitado.
12. Ao encontrar ambiguidade de negócio, registrar a decisão pendente em um `DECISION_LOG.md`, sugerir uma opção segura e continuar o desenvolvimento sem criar regra legal fictícia.
13. O sistema deve indicar claramente a data e versão da regra usada em cada cálculo.
14. O sistema deve aceitar evolução de leiautes do eSocial sem reconstrução total do domínio.
15. Priorizar exatidão, rastreabilidade, idempotência, segurança e manutenibilidade sobre velocidade de entrega.

### 0.2 Aviso obrigatório de governança

Antes da entrada em produção, folha, rescisão, férias, ponto, SST, eSocial, tributos e documentos devem ser homologados por profissionais de DP/contabilidade, SST e jurídico trabalhista. O software auxilia a execução, mas não substitui parecer profissional nem interpretação de convenção coletiva.

---

# 1. VISÃO DO PRODUTO

Construir uma plataforma SaaS/PWA responsiva, com possibilidade de instalação dedicada, capaz de atender:

- uma empresa isolada;
- grupo econômico;
- matriz e filiais;
- escritório contábil administrando várias empresas;
- operação multiempresa e multiestabelecimento;
- trabalhadores CLT e categorias adicionais configuráveis;
- DP interno, gestores, empregados, contabilidade, SST e auditores.

A plataforma será dividida em três experiências:

## 1.1 Portal do Departamento Pessoal

- administração de empresas e estabelecimentos;
- cadastros organizacionais;
- prontuário do trabalhador;
- admissão;
- contratos e alterações;
- ponto e jornada;
- férias;
- afastamentos;
- benefícios;
- folha de pagamento;
- 13º salário;
- rescisões;
- SST;
- documentos e assinaturas;
- eSocial e integrações;
- relatórios, auditoria e fechamento;
- parametrização legal e sindical.

## 1.2 Portal do gestor

- visualizar somente a equipe autorizada;
- solicitar admissões e alterações;
- acompanhar experiência;
- aprovar ponto, justificativas, férias, horas extras e banco de horas;
- registrar ocorrências administrativas permitidas;
- solicitar movimentações e desligamentos;
- acompanhar alertas da equipe sem acessar detalhes médicos ou financeiros proibidos.

## 1.3 Portal do trabalhador

- consultar e baixar holerites, informes e documentos;
- visualizar espelho de ponto e saldo de banco de horas;
- registrar solicitação de ajuste de ponto, sem apagar marcação original;
- solicitar férias;
- enviar documentos e atestados por canal protegido;
- acompanhar benefícios;
- atualizar apenas dados permitidos, mediante validação/aprovação;
- assinar documentos;
- acompanhar solicitações;
- consultar histórico funcional autorizado.

---

# 2. ESCOPO E LIMITES

## 2.1 Escopo prioritário

O MVP robusto deve atender empresas privadas, empregados CLT mensais e horistas, incluindo cadastro, admissão, documentos, férias, afastamentos, benefícios, ponto, competências, motor de rubricas e folha em homologação.

## 2.2 Categorias futuras ou condicionais

Preparar arquitetura extensível, mas não presumir que todas as categorias usam as mesmas regras:

- aprendizes;
- estagiários;
- trabalhadores temporários;
- intermitentes;
- autônomos e contribuintes individuais;
- diretores;
- trabalhadores sem vínculo;
- empregados domésticos;
- servidores públicos e RPPS;
- trabalhadores rurais;
- expatriados.

Cada categoria exige validação própria. Não reutilizar regras de empregado CLT por conveniência.

## 2.3 Fora do escopo inicial

- substituir sistemas governamentais;
- emitir parecer jurídico;
- diagnóstico médico;
- calcular automaticamente regra não homologada;
- transmitir evento oficial sem certificado, procuração, autorização e ambiente configurados;
- armazenar senha de certificado sem cofre seguro.

---

# 3. ARQUITETURA RECOMENDADA

Utilizar arquitetura modular, evitando microserviços prematuros. Começar como **monólito modular**, com fronteiras claras e possibilidade de extração futura.

## 3.1 Stack preferencial

Considerar, salvo restrição do ambiente:

- frontend: React + TypeScript;
- UI: Tailwind CSS e biblioteca de componentes acessível;
- backend: TypeScript com framework estruturado ou equivalente;
- banco: PostgreSQL;
- autenticação: provedor seguro com MFA e suporte a SSO;
- objetos/documentos: armazenamento compatível com S3, com criptografia e URLs temporárias;
- filas: sistema persistente com retry, dead-letter queue e idempotência;
- cache: somente quando necessário, nunca como fonte definitiva de dados legais;
- observabilidade: logs estruturados, métricas, tracing e alertas;
- implantação: contêineres, ambientes separados e pipeline CI/CD.

Caso sejam usados Supabase e Vercel, aplicar RLS, funções de backend para ações privilegiadas, storage privado, secrets fora do frontend e jobs/filas adequados. Nunca confiar apenas em filtros do cliente para isolamento multiempresa.

## 3.2 Módulos de domínio

1. Identidade, autenticação e autorização
2. Tenants, empresas e estabelecimentos
3. Estrutura organizacional
4. Pessoas e prontuários
5. Vínculos e contratos
6. Admissão e onboarding
7. Documentos e assinatura
8. Jornada e ponto
9. Férias
10. Afastamentos
11. Benefícios
12. Folha e motor de cálculo
13. Pagamentos e arquivos bancários
14. Rescisões
15. SST
16. eSocial
17. FGTS e obrigações
18. Convenções coletivas e políticas
19. Workflows e aprovações
20. Notificações
21. Auditoria e conformidade
22. Relatórios e BI
23. Integrações
24. Configuração e versionamento de regras

## 3.3 Padrões técnicos obrigatórios

- UUID/ULID para identificadores internos;
- datas civis como `date`; instantes como `timestamptz` em UTC;
- timezone da empresa configurável, padrão `America/Sao_Paulo` quando aplicável;
- valores monetários em `numeric/decimal`, nunca `float`;
- percentuais com precisão explícita;
- CPF e CNPJ normalizados para comparação e mascarados na interface;
- constraints e chaves estrangeiras no banco;
- transações em operações financeiras;
- optimistic locking ou versão de registro;
- idempotency key em importações, cálculos, pagamentos e transmissões;
- soft delete apenas quando juridicamente e operacionalmente apropriado;
- registros financeiros e legais não devem ser apagados fisicamente por comandos comuns;
- outbox pattern para eventos críticos;
- migrations versionadas;
- feature flags para módulos em homologação.

---

# 4. MODELO MULTIEMPRESA E ORGANIZACIONAL

## 4.1 Entidades mínimas

- Tenant
- Grupo empresarial
- Empresa/empregador
- Estabelecimento/filial/obra
- Lotação tributária
- Centro de custo
- Unidade organizacional
- Departamento
- Setor
- Cargo
- Função
- Posto de trabalho
- Sindicato
- Convenção/acordo coletivo
- Calendário
- Localidade
- Jornada/escala
- Usuário
- Perfil
- Permissão
- Escopo de acesso

## 4.2 Dados da empresa

Controlar com vigência e histórico:

- CNPJ/CAEPF/CNO quando pertinente;
- razão social e nome fantasia;
- natureza jurídica;
- CNAE principal e secundários;
- classificação tributária;
- regime tributário;
- FPAS, terceiros e lotação tributária, quando aplicáveis;
- matriz/filial;
- endereços;
- contatos;
- responsáveis legais;
- responsável de DP;
- escritório contábil;
- configuração bancária;
- parâmetros de folha;
- certificados e procurações, apenas por referência segura;
- configurações eSocial por ambiente;
- calendário e feriados.

## 4.3 Regras

- Todo registro operacional deve conter `tenant_id`.
- Registros empresariais devem conter `company_id` e, quando aplicável, `establishment_id`.
- Um usuário não pode inferir a existência de outro tenant.
- Transferência entre empresas deve ser um processo próprio, não simples edição do CNPJ do vínculo.
- Alterações organizacionais devem preservar histórico temporal.

---

# 5. PESSOA, TRABALHADOR E VÍNCULO

Separar os conceitos:

- **Pessoa:** identidade civil.
- **Trabalhador:** pessoa relacionada ao tenant.
- **Vínculo:** relação da pessoa com um empregador.
- **Contrato:** condições vigentes do vínculo.
- **Lotação:** posição organizacional e tributária em determinado período.

Uma pessoa pode possuir mais de um vínculo e histórico. Não duplicar identidade civil desnecessariamente.

## 5.1 Dados pessoais

- nome civil;
- nome social;
- CPF;
- data de nascimento;
- sexo/gênero somente quando necessário e fundamentado;
- nacionalidade e naturalidade;
- estado civil;
- nome dos responsáveis quando necessário;
- RG/RNE/CRNM e demais documentos aplicáveis;
- endereço com vigência;
- telefones e e-mails;
- contato de emergência;
- escolaridade;
- dados bancários;
- dependentes e respectivas finalidades;
- deficiência e reabilitação quando legalmente necessárias;
- documentos anexos;
- consentimentos quando esta for a base válida, sem usar consentimento como solução universal.

## 5.2 Dados do vínculo

- matrícula interna e matrícula eSocial;
- categoria do trabalhador;
- data de admissão;
- tipo e motivo da admissão;
- tipo de contrato;
- prazo e data de término quando determinado;
- experiência e prorrogação;
- cargo e função;
- CBO quando aplicável;
- salário contratual e unidade de pagamento;
- jornada e escala;
- estabelecimento, lotação e centro de custo;
- sindicato e instrumentos coletivos aplicáveis;
- modalidade de trabalho;
- gestor;
- situação do vínculo;
- datas de alterações;
- exposição a riscos, quando aplicável;
- elegibilidade de benefícios.

## 5.3 Histórico temporal

Implementar tabelas de histórico com `valid_from` e `valid_to` para:

- salário;
- cargo/função;
- lotação;
- jornada;
- centro de custo;
- sindicato;
- local de trabalho;
- gestor;
- modalidade;
- dados cadastrais relevantes.

Não sobrescrever a condição anterior. Uma folha de março deve conseguir reconstruir o contrato válido em março, mesmo após promoção em agosto.

---

# 6. ADMISSÃO E ONBOARDING

## 6.1 Workflow

1. Solicitação de vaga/contratação
2. Aprovação conforme alçada
3. Pré-cadastro
4. Coleta segura de documentos
5. Validações cadastrais
6. Definição do vínculo
7. Exame admissional e aptidão, quando aplicável
8. Definição de salário, cargo, jornada, sindicato e benefícios
9. Geração de documentos
10. Revisão por DP
11. Assinaturas
12. Preparação/envio do evento eSocial aplicável
13. Criação de acessos
14. Entrega de ativos/EPI/benefícios
15. Ativação do vínculo
16. Checklist de integração

## 6.2 Estados

`rascunho`, `documentos_pendentes`, `em_validacao`, `exame_pendente`, `aprovacao_pendente`, `aprovado`, `assinatura_pendente`, `esocial_pendente`, `concluido`, `rejeitado`, `cancelado`.

## 6.3 Validações

- CPF obrigatório e formato válido;
- duplicidade de pessoa e vínculo;
- admissão compatível com abertura do empregador e regras do eSocial;
- contrato determinado com término coerente;
- registros obrigatórios conforme categoria;
- salário não inferior ao piso aplicável, após validação da convenção;
- jornada compatível com escala e contrato;
- exame admissional quando exigível;
- documentos obrigatórios configuráveis;
- impedir ativação com pendências bloqueadoras;
- alertar, sem inventar solução, quando houver conflito sindical ou legal.

## 6.4 Documentos

Usar templates versionados com variáveis. Gerar PDF final, hash, versão, data, autor, signatários e evidências de assinatura. Nunca alterar silenciosamente um documento assinado.

---

# 7. DOCUMENTOS E ASSINATURAS

## 7.1 Tipos

- contrato de trabalho;
- contrato de experiência e prorrogação;
- ficha de registro;
- termos de confidencialidade e políticas;
- acordo de banco de horas;
- termo de teletrabalho;
- autorizações legítimas de desconto;
- termos de benefícios;
- aviso e recibo de férias;
- holerites;
- documentos rescisórios;
- recibo de entrega/devolução de ativos e EPI;
- comunicados e advertências;
- ASO com acesso segregado;
- comprovantes e protocolos.

## 7.2 Requisitos

- templates por empresa e vigência;
- merge fields validados;
- pré-visualização;
- versionamento;
- hash do arquivo;
- storage privado;
- URLs temporárias;
- assinatura eletrônica com trilha de evidência;
- política de retenção por categoria;
- carimbo de data/hora quando aplicável;
- detecção de arquivo alterado;
- bloqueio de acesso por perfil;
- registro de cada visualização, download, exportação e assinatura em documentos sensíveis.

---

# 8. JORNADA, ESCALAS E PONTO

O sistema deve separar:

1. jornada contratual;
2. escala planejada;
3. marcações brutas;
4. ocorrências calculadas;
5. ajustes solicitados;
6. ajustes aprovados;
7. espelho de ponto;
8. efeitos para folha.

## 8.1 Funcionalidades

- jornadas fixas e flexíveis;
- escalas configuráveis, inclusive 12x36 quando juridicamente aplicável;
- turnos e plantões;
- intervalos;
- tolerâncias parametrizadas e versionadas;
- dias úteis, folgas e feriados;
- entrada, saída e intervalos;
- marcação web/mobile/equipamento por integração;
- operação offline somente se houver cadeia segura e sincronização auditável;
- horas extras por faixa;
- adicional noturno e hora noturna conforme regra aplicável;
- atrasos e saídas antecipadas;
- faltas e abonos;
- banco de horas;
- compensações;
- DSR e reflexos por regra homologada;
- aprovação por gestor;
- assinatura/ciência do espelho;
- fechamento e reabertura controlada;
- exportação para folha.

## 8.2 Integridade das marcações

- nunca apagar ou sobrescrever marcação bruta;
- correção deve criar registro separado com motivo, solicitante, aprovador, horário anterior e posterior;
- armazenar origem, dispositivo, IP e geolocalização somente se necessária, transparente e juridicamente validada;
- proibir marcação automática fictícia;
- não impedir marcação por falta de autorização prévia de hora extra;
- comprovante da marcação conforme modalidade de REP;
- arquivos e formatos regulatórios devem ser versionados;
- sincronização idempotente;
- divergências devem entrar em fila de tratamento.

A implementação de REP-C, REP-A ou REP-P deve obedecer à modalidade efetivamente adotada e à regulamentação vigente, especialmente a Portaria MTP nº 671/2021 compilada. Não declarar o produto como REP-P certificado/registrado sem cumprir integralmente requisitos técnicos, assinatura, arquivos e registros aplicáveis.

## 8.3 Banco de horas

- política vinculada a instrumento legal/coletivo;
- vigência;
- prazo de compensação;
- limites;
- tipos de crédito e débito;
- extrato imutável;
- expiração;
- pagamento de saldo;
- tratamento rescisório;
- aprovação;
- trilha de origem de cada lançamento.

---

# 9. FÉRIAS

## 9.1 Conceitos

- período aquisitivo;
- período concessivo;
- direito e quantidade de dias;
- faltas relevantes;
- suspensões/interrupções e impactos;
- programação;
- gozo;
- abono pecuniário;
- adiantamento de 13º;
- férias individuais e coletivas;
- fracionamento;
- recibo e pagamento;
- cancelamento e remarcação;
- férias em rescisão.

## 9.2 Regras de negócio

- gerar período aquisitivo a partir do vínculo, mas calcular direito conforme regras vigentes;
- não assumir automaticamente 30 dias sem verificar condições;
- validar conflito com afastamentos, desligamento, férias já marcadas e políticas;
- calcular prazos e alertas com calendário aplicável;
- controlar solicitação, aprovação, aviso, cálculo, pagamento e gozo como etapas distintas;
- permitir regras por instrumento coletivo, sem contrariar norma superior;
- versionar cálculo e preservar memória;
- permitir simulação sem contabilizar;
- férias pagas/fechadas não podem ser editadas diretamente;
- alterações posteriores devem seguir estorno/reprocessamento controlado;
- alertar férias próximas do limite e situações de risco;
- cuidar para que o início não viole restrições legais vigentes;
- controlar proporcionalidade e médias com fórmulas homologadas.

## 9.3 Estados

`previsto`, `disponivel`, `solicitado`, `em_aprovacao`, `programado`, `calculado`, `aprovado_dp`, `pago`, `em_gozo`, `concluido`, `cancelado`, `vencido`, `indenizado`.

---

# 10. AFASTAMENTOS E LICENÇAS

## 10.1 Tipos

- atestado e incapacidade;
- acidente de trabalho;
- licença-maternidade;
- licença-paternidade;
- adoção;
- serviço militar;
- licenças legais e coletivas;
- suspensão disciplinar;
- suspensão contratual;
- licença não remunerada;
- retornos e prorrogações.

## 10.2 Dados e regras

- motivo interno e código externo;
- início, término previsto e término real;
- último dia trabalhado quando pertinente;
- origem;
- documentos;
- profissional/entidade emissora somente conforme necessidade;
- impacto em ponto, folha, férias, 13º e benefícios;
- estabilidade associada, sem decisão jurídica automática;
- eventos eSocial relacionados;
- prorrogações;
- retorno ao trabalho;
- sobreposição validada;
- sigilo médico;
- anexos criptografados e acesso mínimo.

O gestor comum deve visualizar apenas informação operacional indispensável, como período e status, não diagnóstico ou documento médico detalhado.

---

# 11. BENEFÍCIOS

## 11.1 Catálogo

- vale-transporte;
- vale-refeição;
- vale-alimentação;
- plano de saúde;
- plano odontológico;
- seguro de vida;
- auxílio-creche;
- auxílio-combustível;
- cesta básica;
- previdência privada;
- benefício de bem-estar;
- benefícios personalizados.

## 11.2 Modelo

- fornecedor;
- plano/produto;
- elegibilidade;
- empresa/estabelecimento/categoria;
- titular e dependentes;
- vigência;
- custo da empresa;
- coparticipação;
- desconto do trabalhador;
- teto e percentual;
- carência;
- inclusão/exclusão;
- reajustes;
- movimentação enviada ao fornecedor;
- competência de desconto;
- integração com rubrica;
- conciliação de fatura;
- histórico.

Nenhum desconto deve ser lançado sem fundamento, autorização ou regra válida. Guardar evidência quando necessária.

---

# 12. MOTOR DE FOLHA DE PAGAMENTO

Este módulo exige o maior rigor do projeto.

## 12.1 Princípios

- determinístico;
- versionado;
- reproduzível;
- explicável;
- auditável;
- parametrizável;
- testável;
- com precisão decimal;
- capaz de separar cálculo, aprovação, fechamento e pagamento.

## 12.2 Entidades

- competência;
- tipo de processamento;
- folha/lote;
- trabalhador processado;
- rubrica;
- versão da rubrica;
- incidência;
- regra/fórmula;
- base intermediária;
- resultado;
- memória de cálculo;
- lançamento manual;
- origem;
- diferença;
- arredondamento;
- totalizadores;
- aprovação;
- fechamento;
- pagamento;
- contabilização.

## 12.3 Tipos de processamento

- mensal;
- adiantamento;
- complementar;
- diferença;
- férias;
- 13º primeira parcela;
- 13º segunda parcela;
- rescisão;
- PLR, quando configurada;
- processamento especial.

## 12.4 Rubricas

Cada rubrica deve conter:

- código interno;
- código/identificador externo quando aplicável;
- descrição;
- natureza;
- tipo: provento, desconto ou informativa;
- fórmula ou estratégia de cálculo;
- prioridade/ordem;
- dependências;
- incidências de INSS, FGTS e IRRF;
- reflexos em férias, 13º, aviso e rescisão;
- composição de médias;
- contabilização;
- centro de custo;
- limites mínimo/máximo;
- arredondamento;
- empresa/categoria/sindicato aplicável;
- versão e vigência;
- fonte normativa;
- status de homologação;
- mapeamento eSocial S-1010 e natureza correspondente.

## 12.5 Fórmulas

Não permitir código arbitrário inseguro digitado por usuários. Criar DSL restrita ou árvore de expressão com:

- operações matemáticas seguras;
- condicionais;
- consulta a variáveis permitidas;
- referências a bases e rubricas anteriores;
- funções de arredondamento;
- tabelas progressivas versionadas;
- limites;
- médias;
- proporcionalidade;
- dependências detectáveis;
- timeout e validação;
- simulador;
- suite de testes por regra.

## 12.6 Cálculos esperados

O motor deve suportar, após homologação:

- salário mensal e saldo de salário;
- salário por hora;
- horas extras e faixas;
- adicional noturno;
- insalubridade e periculosidade conforme enquadramento válido;
- comissões e gratificações;
- DSR;
- faltas e atrasos;
- médias;
- férias e adicional constitucional;
- 13º e avos;
- INSS;
- IRRF;
- FGTS;
- pensão alimentícia configurada por determinação válida;
- benefícios;
- adiantamentos;
- empréstimos/consignados conforme integrações e regras vigentes;
- verbas rescisórias;
- retroativos e diferenças.

## 12.7 Competência e fechamento

Estados mínimos:

`aberta`, `coleta`, `pre_calculo`, `com_erros`, `calculada`, `em_conferencia`, `aprovada`, `fechada`, `paga`, `reaberta`, `retificada`, `cancelada`.

Regras:

- impedir fechamento com erro bloqueador;
- snapshot dos dados usados;
- hash do lote;
- dupla aprovação configurável;
- reabertura exige permissão forte, justificativa e auditoria;
- reprocessamento deve mostrar diferenças antes de substituir resultado não fechado;
- folha fechada gera somente correção formal, nunca edição silenciosa;
- conferência por totalizadores e comparação com competência anterior;
- alertas por variação anormal;
- conciliação entre folha, pagamento, eSocial, FGTS e contabilidade.

## 12.8 Memória de cálculo

Para cada rubrica, exibir:

- origem;
- fórmula;
- variáveis;
- valores intermediários;
- tabela legal usada;
- versão;
- vigência;
- resultado antes/depois do arredondamento;
- usuário/processo que provocou o cálculo;
- data e identificador da execução.

---

# 13. DÉCIMO TERCEIRO

Suportar avos, adiantamento, parcela final, médias, afastamentos, rescisão e ajuste. A Lei nº 4.090/1962 prevê a gratificação e a apuração em doze avos, considerando como mês integral a fração igual ou superior a 15 dias; a Lei nº 4.749/1965 disciplina adiantamento e pagamento. Implementar por regra versionada e homologada, sem congelar valores ou interpretações no código.

---

# 14. RESCISÕES E OFFBOARDING

## 14.1 Motivos

- pedido de demissão;
- dispensa sem justa causa;
- justa causa;
- término antecipado ou normal de contrato;
- acordo;
- falecimento;
- rescisão indireta por decisão válida;
- transferência/sucessão quando aplicável;
- outros códigos oficiais vigentes.

## 14.2 Workflow

1. Solicitação
2. Aprovação por alçada
3. Definição de motivo, iniciativa e datas
4. Aviso-prévio
5. Bloqueio preventivo de alterações incompatíveis
6. Cálculo simulado
7. Conferência por DP
8. Exame demissional quando aplicável
9. Cálculo final
10. Aprovação
11. Geração de documentos
12. Pagamento
13. Evento eSocial
14. FGTS/obrigações aplicáveis
15. Devolução de equipamentos e acessos
16. Encerramento de benefícios
17. Entrevista de desligamento opcional
18. Encerramento do vínculo e retenção do prontuário

## 14.3 Motor rescisório

Deve considerar, conforme modalidade e regra vigente:

- saldo de salário;
- aviso-prévio;
- férias vencidas e proporcionais;
- adicional constitucional;
- 13º proporcional;
- médias e reflexos;
- descontos permitidos;
- benefícios;
- FGTS e indenizações aplicáveis;
- pensão;
- adiantamentos;
- datas e prazos;
- estabilidade ou alerta de possível estabilidade;
- convenção coletiva.

O sistema deve emitir alertas, mas não decidir sozinho questões jurídicas controversas. Exigir aprovação humana em justa causa, estabilidade, acordo, falecimento, decisão judicial e rescisões de alto risco.

---

# 15. SST: SAÚDE E SEGURANÇA DO TRABALHO

## 15.1 Estrutura

- ambientes de trabalho;
- cargos/funções e riscos;
- inventário de riscos/PGR;
- PCMSO;
- exames ocupacionais;
- ASO;
- aptidão e restrições operacionais autorizadas;
- agentes nocivos;
- EPI e EPC;
- treinamentos;
- acidentes;
- CAT;
- vínculos com eventos S-2210, S-2220 e S-2240;
- prestadores e clínicas;
- alertas de validade.

## 15.2 Exames

- admissional;
- periódico;
- retorno ao trabalho;
- mudança de risco ocupacional;
- demissional;
- complementares conforme programa médico.

A NR-7 estabelece diretrizes para o PCMSO, relacionado aos riscos ocupacionais avaliados no PGR. O sistema deve apoiar controle e evidências, sem tentar substituir médico do trabalho ou responsável técnico.

## 15.3 Privacidade médica

- diagnóstico não deve ficar disponível ao gestor comum;
- armazenar somente o mínimo necessário;
- separar banco lógico/permissões para documentos médicos;
- criptografia de campo para informações críticas;
- logs de acesso;
- download restrito;
- proibir uso de dados de saúde em avaliação de desempenho ou decisões automatizadas ilegítimas.

---

# 16. ESOCIAL

Utilizar a documentação técnica oficial vigente. Na data-base deste documento, a documentação oficial informa leiaute S-1.3 consolidado com atualizações de 2026. O sistema não deve assumir que essa versão será permanente.

## 16.1 Eventos prioritários

Preparar suporte, conforme obrigação e categoria, para:

- S-1000 empregador;
- S-1005 estabelecimentos;
- S-1010 rubricas;
- S-1020 lotações tributárias;
- S-1070 processos;
- S-1200 remuneração RGPS;
- S-1210 pagamentos;
- S-1280 informações complementares;
- S-1298 reabertura;
- S-1299 fechamento;
- S-2190 registro preliminar;
- S-2200 admissão;
- S-2205 alteração cadastral;
- S-2206 alteração contratual;
- S-2210 CAT;
- S-2220 saúde;
- S-2230 afastamento;
- S-2240 condições ambientais;
- S-2298 reintegração;
- S-2299 desligamento;
- S-2300/S-2306/S-2399 para TSVE quando escopo aprovado;
- eventos de processo trabalhista quando incluídos no produto.

## 16.2 Arquitetura do conector

Separar:

- versão do leiaute;
- schemas XSD;
- regras de validação;
- mapeamento do domínio;
- geração do XML;
- assinatura;
- lote/transmissão;
- consulta;
- retorno;
- recibo;
- totalizadores;
- retificação/exclusão;
- ambiente de produção restrita e produção.

## 16.3 Estados do evento

`rascunho`, `pendente_validacao`, `invalido`, `validado`, `aguardando_dependencia`, `aguardando_assinatura`, `na_fila`, `enviado`, `em_processamento`, `aceito`, `aceito_com_advertencia`, `rejeitado`, `retificacao_pendente`, `retificado`, `exclusao_pendente`, `excluido`, `cancelado`.

## 16.4 Regras técnicas

- validar XSD e regras antes do envio;
- guardar XML exato enviado e retorno recebido;
- guardar protocolo, recibo, ambiente, versão e certificado utilizado;
- assinatura em componente seguro;
- idempotência para impedir duplicidade;
- dependência entre eventos;
- retry com backoff somente para falha transitória;
- rejeição de regra vai para fila humana, não retry infinito;
- DLQ;
- correlação ponta a ponta;
- mascarar dados em logs;
- permitir reprocessamento após correção;
- dashboard por competência, evento e status;
- reconciliação entre domínio interno e retorno governamental;
- importar/conciliar eventos externos quando possível e autorizado.

---

# 17. FGTS DIGITAL E OBRIGAÇÕES

O FGTS Digital usa informações declaradas no eSocial para formar débitos e guias. Portanto, a plataforma deve conciliar:

- remunerações;
- incidências de rubricas;
- vínculos;
- desligamentos;
- totalizadores retornados;
- débitos;
- guias;
- pagamentos;
- divergências.

Não confundir cálculo interno com confirmação do sistema oficial. Exibir claramente:

- estimado;
- declarado;
- totalizado pelo órgão;
- guia emitida;
- pago;
- conciliado;
- divergente.

Criar agenda de obrigações parametrizada por competência, empresa e regime. Prazos não devem estar fixos no código e devem considerar mudança normativa, antecipação por dia não útil e exceções.

---

# 18. CONVENÇÕES, ACORDOS COLETIVOS E POLÍTICAS

## 18.1 Entidades

- sindicato laboral;
- sindicato patronal;
- instrumento coletivo;
- vigência;
- abrangência territorial;
- categorias abrangidas;
- pisos;
- reajustes;
- benefícios;
- adicionais;
- banco de horas;
- jornadas;
- estabilidade;
- contribuições;
- cláusulas cadastradas;
- documento original;
- revisão e homologação.

## 18.2 Motor de aplicabilidade

Resolver a regra por:

1. trabalhador;
2. categoria;
3. estabelecimento/localidade;
4. sindicato;
5. vigência;
6. empresa;
7. regra mais específica;
8. prioridade validada.

Conflitos devem produzir alerta e exigir decisão humana. O agente não deve escolher automaticamente a interpretação “mais barata”.

---

# 19. WORKFLOWS E APROVAÇÕES

Criar engine configurável para:

- admissão;
- alteração salarial;
- promoção/transferência;
- férias;
- ponto;
- hora extra;
- afastamento;
- benefício;
- folha;
- rescisão;
- acesso a documento sensível;
- reabertura de competência.

Recursos:

- etapas sequenciais/paralelas;
- alçada por valor, cargo, empresa e centro de custo;
- substituto/delegação temporária;
- SLA;
- lembrete e escalonamento;
- comentário e anexo;
- aprovação/reprovação com justificativa;
- segregação de funções;
- prevenção de autoaprovação;
- histórico imutável.

---

# 20. SEGURANÇA, LGPD E PRIVACIDADE

## 20.1 Classificação de dados

- públicos;
- internos;
- confidenciais;
- pessoais;
- pessoais sensíveis;
- financeiros;
- médicos;
- credenciais/segredos.

## 20.2 Controles

- MFA obrigatório para perfis privilegiados;
- RBAC combinado com escopo e atributos;
- menor privilégio;
- segregação DP, gestor, financeiro, SST, jurídico e auditor;
- RLS no banco quando disponível;
- criptografia em trânsito e repouso;
- criptografia de campos críticos;
- rotação de secrets;
- cofre de certificados;
- sessões curtas para ações privilegiadas;
- reautenticação para exportação, folha, rescisão e configuração;
- proteção contra OWASP Top 10;
- rate limiting;
- CSRF/XSS/SQL injection prevenidos;
- antivírus/antimalware em uploads;
- tipos e tamanhos de arquivo restritos;
- backup criptografado;
- restauração testada;
- alertas de acesso anormal;
- revisão periódica de acessos;
- desligamento imediato de usuários;
- proibição de dados pessoais em logs, URLs e analytics.

## 20.3 LGPD by design

- inventário de dados e finalidades;
- base legal por atividade de tratamento;
- minimização;
- transparência;
- retenção e descarte;
- atendimento a direitos do titular com avaliação de obrigações legais de retenção;
- registro de operações de tratamento;
- gestão de operadores/suboperadores;
- plano de resposta a incidentes;
- evidência de consentimento somente onde consentimento for apropriado;
- relatório de impacto quando necessário;
- anonimização/pseudonimização em BI e ambientes de teste;
- dados sintéticos em desenvolvimento;
- exportação controlada e registrada.

## 20.4 Auditoria

Registrar:

- ator;
- ação;
- data/hora;
- tenant/empresa;
- recurso;
- ID do registro;
- antes/depois com proteção de campos sensíveis;
- motivo;
- IP/dispositivo quando necessário;
- correlação;
- origem;
- aprovação associada.

Logs de auditoria não podem ser alterados por usuários comuns ou administradores funcionais.

---

# 21. RELATÓRIOS, DASHBOARDS E BI

## 21.1 Operacionais

- admissões pendentes;
- documentos faltantes;
- experiência a vencer;
- férias a vencer/vencidas;
- afastamentos ativos;
- exames e treinamentos vencendo;
- inconsistências de ponto;
- competências e fechamentos;
- eventos eSocial rejeitados;
- benefícios e movimentações;
- desligamentos em andamento.

## 21.2 Gestão

- headcount;
- admissões e desligamentos;
- turnover;
- absenteísmo;
- horas extras;
- banco de horas;
- custo de folha;
- custo por centro de custo;
- provisões;
- distribuição salarial;
- diversidade somente com finalidade legítima e proteção;
- indicadores de SLA.

## 21.3 Requisitos de BI

- métricas com dicionário e fórmula;
- período de referência explícito;
- filtros por escopo autorizado;
- dados agregados para reduzir exposição;
- suppressão de grupos pequenos quando houver risco de reidentificação;
- exportação auditada;
- visão temporal;
- reconciliação com a fonte transacional.

---

# 22. NOTIFICAÇÕES E AGENDA

Canais: in-app, e-mail e integrações autorizadas. Não enviar salário, diagnóstico, CPF completo ou documento sensível em notificação aberta.

Alertas:

- prazo de admissão;
- documento pendente;
- fim de experiência;
- férias;
- exame/treinamento;
- afastamento/retorno;
- ponto pendente;
- fechamento de folha;
- obrigação legal;
- rejeição eSocial;
- certificado próximo do vencimento;
- falha de integração;
- acesso suspeito.

Permitir preferências, escalonamento, deduplicação e registro de entrega.

---

# 23. INTEGRAÇÕES

Criar camada de adaptadores para:

- eSocial;
- FGTS Digital, quando houver meio oficial/autorizado;
- bancos e arquivos de pagamento;
- contabilidade/ERP;
- relógios e sistemas de ponto;
- fornecedores de benefícios;
- clínicas de SST;
- assinatura eletrônica;
- identidade/SSO;
- storage;
- e-mail.

Toda integração deve ter:

- contrato versionado;
- autenticação segura;
- idempotência;
- retry controlado;
- timeout;
- circuit breaker quando necessário;
- log técnico sem dado sensível;
- fila de erro;
- reconciliação;
- importação simulada/dry run;
- relatório de registros aceitos, rejeitados e duplicados.

---

# 24. EXPERIÊNCIA DO USUÁRIO

## 24.1 Princípios UX

- interface em português do Brasil;
- datas no formato local, armazenamento técnico correto;
- moeda brasileira;
- linguagem clara;
- acessibilidade WCAG 2.1 AA ou superior;
- navegação por teclado;
- responsividade;
- feedback de processamento;
- prevenção contra dupla submissão;
- validação de formulário acessível;
- ações destrutivas com contexto;
- autosave apenas onde seguro;
- filtros preservados;
- telas densas com boa legibilidade.

## 24.2 Telas mínimas

1. Login/MFA/recuperação
2. Seleção de empresa
3. Dashboard DP
4. Empresas e estabelecimentos
5. Estrutura organizacional
6. Trabalhadores
7. Prontuário 360º
8. Admissões
9. Contratos e históricos
10. Documentos
11. Jornadas e escalas
12. Central de ponto
13. Férias
14. Afastamentos
15. Benefícios
16. Competências
17. Rubricas e regras
18. Cálculo/conferência da folha
19. 13º
20. Rescisões
21. SST
22. Central eSocial
23. Obrigações e calendário
24. Relatórios
25. Auditoria
26. Usuários, perfis e permissões
27. Integrações
28. Configurações
29. Portal do gestor
30. Portal do trabalhador

## 24.3 Prontuário 360º

Abas:

- resumo;
- dados pessoais;
- vínculo;
- histórico contratual;
- jornada/ponto;
- férias;
- afastamentos;
- benefícios;
- folha/holerites;
- documentos;
- SST, fortemente restrito;
- eventos eSocial;
- ativos/EPI;
- aprovações;
- auditoria.

---

# 25. API E CONTRATOS

- API versionada;
- OpenAPI;
- schemas explícitos;
- paginação cursor-based em grandes volumes;
- filtros allowlist;
- erros padronizados com código, mensagem segura e correlation ID;
- validação server-side;
- autorização em cada endpoint;
- idempotency key em POSTs críticos;
- evitar retornar dados além do necessário;
- webhooks assinados e com proteção contra replay;
- rate limit por tenant e usuário;
- endpoints de exportação assíncronos.

---

# 26. QUALIDADE E TESTES

## 26.1 Pirâmide

- testes unitários;
- testes do motor de regras;
- testes de integração;
- testes de contrato;
- testes E2E;
- testes de segurança;
- testes de carga;
- testes de migração;
- testes de restauração;
- testes de acessibilidade.

## 26.2 Casos obrigatórios

- isolamento entre tenants;
- usuário sem permissão;
- histórico temporal;
- mudança de salário no meio da competência;
- admissão/desligamento no mês;
- férias sobrepostas;
- afastamentos sobrepostos;
- virada de ano e ano bissexto;
- timezone e horário de verão histórico;
- arredondamentos;
- cálculo repetido produz mesmo resultado;
- formula circular bloqueada;
- reabertura e retificação;
- duplicidade de eventos e importações;
- falha parcial de integração;
- arquivo malicioso;
- certificado vencido;
- eSocial rejeitado;
- restauração de backup;
- concorrência entre usuários;
- exportação com escopo incorreto bloqueada.

## 26.3 Golden tests de folha

Manter massa anonimizada ou sintética homologada com resultados esperados para cada versão de regra. Toda alteração no motor deve executar regressão completa. Diferenças exigem justificativa e aprovação.

---

# 27. DEVOPS, AMBIENTES E OPERAÇÃO

Ambientes isolados:

- local;
- desenvolvimento;
- teste;
- homologação;
- produção.

Requisitos:

- nenhuma cópia de produção sem anonimização;
- CI com lint, testes, SAST e verificação de dependências;
- CD com aprovação para produção;
- migrations com rollback planejado;
- backup e PITR;
- RPO/RTO definidos;
- health checks;
- métricas de fila;
- monitoramento de jobs;
- alertas de segurança;
- logs centralizados;
- runbooks;
- plano de continuidade;
- feature flags;
- changelog;
- status de serviço.

---

# 28. ROADMAP OBRIGATÓRIO

## Fase 0: descoberta e fundação

- mapa de processos;
- perfis e matriz de acesso;
- glossário;
- decisões arquiteturais;
- modelo de dados;
- threat model;
- inventário LGPD;
- fontes legais;
- plano de homologação.

## Fase 1: núcleo administrativo

- multiempresa;
- autenticação e autorização;
- estrutura organizacional;
- pessoa, trabalhador e vínculo;
- admissão;
- documentos;
- workflows;
- portal básico;
- auditoria.

## Fase 2: férias, afastamentos e benefícios

- períodos aquisitivos;
- solicitações e aprovações;
- afastamentos;
- benefícios;
- alertas.

## Fase 3: ponto

- jornadas;
- escalas;
- marcações;
- tratamento;
- banco de horas;
- espelho;
- fechamento;
- conformidade com modalidade de REP escolhida.

## Fase 4: motor de folha em homologação

- competências;
- rubricas;
- DSL;
- memória de cálculo;
- folha mensal;
- férias;
- 13º;
- rescisão;
- golden tests;
- dupla conferência.

## Fase 5: integrações legais

- eSocial em produção restrita;
- assinatura e certificado;
- filas e retornos;
- conciliação;
- FGTS/obrigações;
- integração contábil e bancária.

## Fase 6: SST

- riscos;
- PCMSO;
- exames;
- EPI;
- CAT;
- eventos SST;
- segregação médica.

## Fase 7: RH estratégico

- recrutamento;
- treinamento;
- desempenho;
- clima;
- cargos e salários.

Não avançar módulo crítico sem critérios de saída da fase anterior.

---

# 29. ENTREGÁVEIS EXIGIDOS DO AGENTE

Antes de produzir muitas telas, gerar e manter:

1. `README.md`
2. `PRODUCT_VISION.md`
3. `SCOPE.md`
4. `GLOSSARY.md`
5. `ARCHITECTURE.md`
6. `ADR/` com decisões arquiteturais
7. `DOMAIN_MODEL.md`
8. `ERD.md` com Mermaid
9. `PERMISSIONS_MATRIX.md`
10. `WORKFLOWS.md`
11. `BUSINESS_RULES.md`
12. `CALCULATION_ENGINE.md`
13. `ESOCIAL_INTEGRATION.md`
14. `SECURITY.md`
15. `LGPD.md`
16. `THREAT_MODEL.md`
17. `AUDIT_MODEL.md`
18. `API_SPEC.md`/OpenAPI
19. `TEST_PLAN.md`
20. `LEGAL_SOURCES.md`
21. `DECISION_LOG.md`
22. `CHANGELOG.md`
23. scripts de migrations e seeds sintéticos
24. aplicação executável
25. testes automatizados
26. dados de demonstração sem dados reais
27. manual operacional e runbooks.

---

# 30. CRITÉRIOS DE ACEITE GERAIS

Uma funcionalidade só está concluída quando:

- possui validação frontend e backend;
- respeita tenant e permissões;
- gera auditoria;
- possui testes;
- possui tratamento de erro;
- está documentada;
- usa datas e decimais corretamente;
- possui estados e transições controlados;
- não expõe dado sensível;
- tem critérios de homologação;
- preserva histórico;
- é idempotente quando aplicável;
- foi avaliada quanto a LGPD;
- apresenta fonte e versão das regras legais;
- possui acessibilidade mínima;
- possui observabilidade;
- não quebra resultados fechados anteriores.

Para folha, ponto, rescisão, férias, SST e eSocial, exigir também homologação funcional por especialista.

---

# 31. PROIBIÇÕES

O agente não pode:

- apagar marcação original de ponto;
- editar folha fechada sem processo formal;
- sobrescrever salário histórico;
- armazenar senha ou certificado no código;
- expor secrets no frontend;
- usar `float` para dinheiro;
- confiar somente em validação do frontend;
- usar dados reais em desenvolvimento;
- registrar CPF, salário, diagnóstico ou XML completo em log comum;
- permitir acesso médico a gestor comum;
- criar fórmulas legais com base em memória ou suposição;
- transmitir ao eSocial sem validação, autorização e trilha;
- usar consentimento como base genérica para todo tratamento;
- permitir exportação em massa sem permissão e auditoria;
- tratar reprocessamento como simples `UPDATE` destrutivo;
- misturar ambientes de testes e produção;
- declarar conformidade legal sem evidência e homologação.

---

# 32. REFERÊNCIAS OFICIAIS INICIAIS

O agente deve verificar versões vigentes antes de cada implementação e registrar data de consulta.

- CLT compilada: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm
- Reforma trabalhista, Lei nº 13.467/2017: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13467.htm
- LGPD, Lei nº 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- FGTS, Lei nº 8.036/1990: https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm
- Custeio da Seguridade, Lei nº 8.212/1991: https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm
- Benefícios da Previdência, Lei nº 8.213/1991: https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm
- 13º salário, Lei nº 4.090/1962: https://www.planalto.gov.br/ccivil_03/leis/l4090.htm
- Pagamento do 13º, Lei nº 4.749/1965: https://www.planalto.gov.br/ccivil_03/leis/l4749.htm
- Documentação técnica eSocial: https://www.gov.br/esocial/pt-br/documentacao-tecnica
- Leiautes eSocial S-1.3, referência na data-base: https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-s-1-3-nt-06-2026/index.html
- Tabelas eSocial: https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-s-1-3-nt-06-2026/tabelas.html
- FGTS Digital: https://www.fgts.gov.br/Paginas/empregador/fgts-digital.aspx
- Manual FGTS Digital: https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/manual-e-documentacao-tecnica/
- Portaria MTP nº 671/2021 e atualizações: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/
- Perguntas e respostas sobre registro eletrônico de ponto: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP
- Normas Regulamentadoras: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora
- IRRF: https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/IRRF

Fontes secundárias podem ajudar na interpretação, mas não devem substituir legislação, manuais oficiais, instrumentos coletivos e validação profissional.

---

# 33. PRIMEIRA ORDEM DE EXECUÇÃO AO AGENTE

Execute nesta ordem, sem pular diretamente para a folha:

1. Analise integralmente esta especificação.
2. Gere o glossário do domínio.
3. Liste premissas, riscos e decisões pendentes.
4. Defina personas e matriz de permissões.
5. Modele bounded contexts e dependências.
6. Proponha ERD temporal e multiempresa.
7. Faça threat model e inventário LGPD.
8. Defina workflows e state machines.
9. Defina arquitetura do motor de regras e versionamento.
10. Defina estratégia de eSocial desacoplada por versão.
11. Produza roadmap em épicos, features e histórias.
12. Para cada história, escreva critérios de aceite em Given/When/Then.
13. Implemente primeiro identidade, tenancy, autorização, auditoria e cadastros-base.
14. Use dados exclusivamente sintéticos.
15. Entregue incrementos pequenos, executáveis e testados.
16. Ao final de cada incremento, informe:
    - o que foi implementado;
    - arquivos criados/alterados;
    - migrations;
    - testes executados;
    - riscos;
    - pendências de homologação;
    - próximo passo.

---

# 34. RESULTADO ESPERADO

O resultado não deve ser apenas uma interface bonita. Deve ser uma plataforma que:

- represente corretamente a vida funcional do trabalhador;
- preserve histórico e evidências;
- permita cálculos explicáveis e versionados;
- organize obrigações e prazos;
- integre-se de modo seguro com sistemas externos;
- proteja dados pessoais e sensíveis;
- ofereça autosserviço sem perder governança;
- permita auditoria completa;
- suporte evolução legislativa;
- reduza retrabalho e risco operacional;
- possa crescer de DP administrativo para RH completo.

**Comece pela documentação e pela fundação segura. Não implemente regras legais críticas por aproximação.**
