# Especificação de Cadastro Rico de Colaborador — Sistema de RH

## Objetivo

Este documento define uma estrutura completa para o cadastro e gestão do colaborador em um sistema de RH.

A ideia é que o cadastro não seja apenas uma ficha de admissão, mas um **dossiê digital do colaborador**, capaz de alimentar:

- Admissão
- Folha de pagamento
- Benefícios
- Ponto
- Férias
- Afastamentos
- SST
- Documentos
- Avaliação de desempenho
- Histórico funcional
- Gestão de equipamentos
- Controle de acessos
- Desligamento
- Integrações futuras com eSocial e outros serviços

> **Princípio importante:** separar dados cadastrais, dados contratuais, históricos e documentos. Evitar uma única tabela gigante com centenas de campos.

---

# 1. Dados pessoais

## 1.1 Identificação

- ID interno do colaborador
- Matrícula
- Nome completo
- Nome social
- CPF
- RG
- Órgão expedidor do RG
- UF do RG
- Data de emissão do RG
- Data de nascimento
- Sexo
- Estado civil
- Nacionalidade
- Naturalidade
- UF de nascimento
- Nome da mãe
- Nome do pai
- Grau de instrução
- Foto
- Status do colaborador

### Status sugeridos

- Pré-admissão
- Em admissão
- Ativo
- Em experiência
- Afastado
- Férias
- Suspenso
- Desligado
- Inativo

---

# 2. Contatos

## 2.1 Contato principal

- E-mail pessoal
- E-mail corporativo
- Celular
- Telefone residencial
- Telefone comercial
- WhatsApp

## 2.2 Contato de emergência

- Nome
- Parentesco
- Telefone
- Celular
- E-mail
- Observações

---

# 3. Endereço

- CEP
- Logradouro
- Número
- Complemento
- Bairro
- Cidade
- Estado
- País
- Ponto de referência
- Tipo de residência

### Funcionalidade recomendada

Integração com serviço de CEP para preencher automaticamente:

- Logradouro
- Bairro
- Cidade
- UF

## 3.1 Estrangeiro

Quando aplicável:

- País de residência
- Endereço no exterior
- País de nascimento
- Data de chegada ao Brasil
- Tipo de visto
- Data de validade do visto
- Documento migratório
- Número do documento migratório
- Órgão emissor

---

# 4. Documentos pessoais

Não criar apenas campos fixos. Criar uma entidade/tabela de documentos permitindo vários documentos por colaborador.

## Tipos de documentos

- CPF
- RG
- CNH
- CTPS
- PIS/PASEP/NIS
- Título de eleitor
- Certidão de nascimento
- Certidão de casamento
- Certificado de reservista
- Registro profissional
- Documento migratório
- Comprovante de residência
- Outros

## Campos do documento

- ID
- Colaborador
- Tipo
- Número
- Órgão emissor
- UF
- Data de emissão
- Data de validade
- Arquivo
- Nome do arquivo
- Observação
- Status
- Data de cadastro
- Usuário responsável pelo cadastro

---

# 5. Dados da admissão

- Empresa
- Filial
- Matrícula
- Data de admissão
- Data de início das atividades
- Tipo de admissão
- Motivo da admissão
- Categoria do trabalhador
- Categoria eSocial
- CBO
- Cargo
- Função
- Departamento
- Setor
- Centro de custo
- Unidade de negócio
- Local de trabalho
- Gestor direto
- Regime de trabalho
- Tipo de contrato
- Data de início do contrato
- Data de término do contrato
- Contrato por prazo determinado?
- Contrato de experiência?
- Prazo inicial da experiência
- Data final da experiência
- Prorrogação da experiência
- Data final da prorrogação
- Observações

---

# 6. Cargo e estrutura organizacional

Criar entidades separadas para permitir histórico.

## Cargo

- ID
- Nome
- CBO
- Descrição
- Salário-base
- Faixa salarial
- Nível
- Família de cargos
- Departamento
- Ativo/inativo

## Lotação

- Empresa
- Filial
- Departamento
- Setor
- Centro de custo
- Unidade
- Local de trabalho
- Gestor
- Data de início
- Data de término

## Histórico

Toda alteração deverá gerar histórico:

- Cargo anterior
- Cargo novo
- Setor anterior
- Setor novo
- Gestor anterior
- Gestor novo
- Data da alteração
- Usuário responsável
- Motivo

---

# 7. Dados salariais

- Salário base
- Periodicidade
- Tipo de remuneração
- Salário hora
- Salário dia
- Salário mensal
- Comissão
- Percentual de comissão
- Gratificação
- Adicional
- Insalubridade
- Periculosidade
- Adicional noturno
- Outros adicionais
- Convenção coletiva
- Sindicato
- Piso salarial
- Data de vigência

## Histórico salarial

Nunca sobrescrever o histórico.

Manter:

- Data de início
- Data de término
- Salário
- Tipo de alteração
- Motivo
- Cargo naquele momento
- Usuário responsável
- Observação

### Exemplo

```text
01/01/2025 — R$ 2.000,00 — Admissão
01/01/2026 — R$ 2.300,00 — Reajuste
01/07/2026 — R$ 2.600,00 — Promoção
```

---

# 8. Jornada e escala

- Tipo de jornada
- Carga horária semanal
- Carga horária mensal
- Horas por dia
- Escala
- Horário de entrada
- Horário de saída
- Intervalo
- Controle de ponto
- Banco de horas
- Tolerância
- Trabalho presencial
- Trabalho híbrido
- Trabalho remoto
- Regime de compensação

## Escalas possíveis

- 5x2
- 6x1
- 12x36
- 4x3
- Escala personalizada

Criar histórico de jornadas para evitar perda de informações antigas.

---

# 9. Dados bancários

Área com acesso restrito.

- Banco
- Código do banco
- Agência
- Dígito da agência
- Conta
- Dígito da conta
- Tipo de conta
- Chave Pix
- Tipo de chave Pix
- Titular
- CPF do titular
- Banco utilizado para salário
- Data de início
- Data de término
- Conta principal

---

# 10. Benefícios

Benefícios devem ser tratados como entidades próprias.

## 10.1 Vale-transporte

- Utiliza?
- Tipo
- Operadora
- Número/cartão
- Quantidade diária
- Valor da tarifa
- Quantidade de viagens
- Valor mensal
- Percentual de desconto
- Data de início
- Data de término

## 10.2 Vale-refeição

- Utiliza?
- Operadora
- Número do cartão
- Valor diário
- Dias considerados
- Valor mensal
- Desconto do colaborador
- Subsídio da empresa
- Data de início
- Data de término

## 10.3 Vale-alimentação

- Utiliza?
- Operadora
- Número do cartão
- Valor mensal
- Desconto do colaborador
- Subsídio da empresa
- Data de início
- Data de término

## 10.4 Plano de saúde

- Utiliza?
- Operadora
- Plano
- Número da carteirinha
- Tipo de acomodação
- Coparticipação
- Valor colaborador
- Valor empresa
- Data de inclusão
- Data de exclusão
- Dependentes vinculados

## 10.5 Plano odontológico

Mesma estrutura do plano de saúde.

## 10.6 Outros benefícios

Suportar benefícios configuráveis:

- Seguro de vida
- Auxílio combustível
- Auxílio creche
- Auxílio home office
- Convênio farmácia
- Previdência privada
- Gympass/Wellhub
- Empréstimos
- Benefícios personalizados

---

# 11. Dependentes

Criar uma tabela própria para permitir múltiplos dependentes.

## Campos

- ID
- Colaborador
- Nome completo
- CPF
- Data de nascimento
- Sexo
- Grau de parentesco
- Tipo de dependente
- Dependente para IR?
- Dependente para salário-família?
- Possui incapacidade?
- Data de início da dependência
- Data de término
- Documento
- Arquivo
- Observações

## Exemplos

- Filho
- Filha
- Cônjuge
- Companheiro(a)
- Pai
- Mãe
- Dependente judicial
- Outro

---

# 12. Formação acadêmica

- Escolaridade
- Instituição
- Curso
- Grau
- Modalidade
- Data de início
- Data de conclusão
- Situação
- Certificado
- Arquivo
- Observações

## Níveis

- Fundamental incompleto
- Fundamental completo
- Médio incompleto
- Médio completo
- Técnico
- Superior incompleto
- Superior completo
- Pós-graduação
- MBA
- Mestrado
- Doutorado

---

# 13. Cursos, competências e certificações

## Cursos

- Nome
- Instituição
- Carga horária
- Data de conclusão
- Data de validade
- Certificado
- Arquivo

## Certificações

- Nome
- Instituição emissora
- Número
- Data de emissão
- Data de validade
- Status
- Arquivo

## Idiomas

- Idioma
- Nível de leitura
- Nível de escrita
- Nível de conversação
- Nível de compreensão

## Competências

Criar catálogo de competências:

- Nome
- Categoria
- Descrição
- Nível

E depois vincular ao colaborador:

- Competência
- Nível
- Data de avaliação
- Avaliador

---

# 14. Saúde ocupacional e SST

Módulo com acesso altamente restrito.

## ASO

- Tipo de exame
- Data
- Médico
- CRM
- Resultado
- Apto/inapto
- Data de validade
- Arquivo

## Exames

- Tipo
- Data
- Resultado
- Médico/laboratório
- Arquivo
- Observação

## Outros controles

- Exames periódicos
- Exame demissional
- Exame de retorno
- Exame de mudança de função
- Acidente de trabalho
- CAT
- Afastamentos ocupacionais
- Controle de vencimentos

> Evitar coletar dados de saúde que não sejam necessários para a finalidade do processo. Restringir acesso e registrar auditoria.

---

# 15. PCD e inclusão

- É PCD?
- Tipo de deficiência
- Grau, quando aplicável
- Reabilitado pelo INSS?
- Necessidade de adaptação
- Recursos de acessibilidade
- Laudo
- Data do laudo
- Validade
- Arquivo

---

# 16. Documentação de admissão

Criar uma checklist configurável por empresa/cargo.

## Documentos comuns

- RG
- CPF
- CTPS
- Comprovante de residência
- Certidão de nascimento/casamento
- Certidão dos dependentes
- Comprovante bancário
- Foto
- ASO admissional
- Documentos profissionais
- Documentos específicos da função

## Campos

- Tipo de documento
- Obrigatório?
- Entregue?
- Data de entrega
- Data de validade
- Arquivo
- Conferido por
- Data da conferência
- Status
- Observação

## Status

- Pendente
- Enviado
- Em análise
- Aprovado
- Reprovado
- Expirado

---

# 17. Contratos e assinaturas

Permitir documentos gerados automaticamente.

## Exemplos

- Contrato de trabalho
- Contrato de experiência
- Termo de confidencialidade
- Termo LGPD
- Termo de uso de equipamentos
- Termo de vale-transporte
- Termo de benefícios
- Política de segurança
- Política interna
- Termo de trabalho remoto
- Termo de responsabilidade
- Termo de entrega de uniforme

## Controle

- Documento
- Versão
- Data de geração
- Data de envio
- Data de assinatura
- Status da assinatura
- Assinante
- Assinatura digital
- Evidência da assinatura
- IP
- Data/hora
- Arquivo final

---

# 18. Equipamentos e patrimônio

Permitir registrar ativos entregues.

## Exemplos

- Notebook
- Desktop
- Monitor
- Celular
- Tablet
- Headset
- Teclado
- Mouse
- Veículo
- Uniforme
- Crachá
- Token
- Outros

## Campos

- Patrimônio
- Tipo
- Marca
- Modelo
- Número de série
- Data de entrega
- Estado
- Acessórios
- Termo assinado
- Data de devolução
- Estado na devolução
- Observações

---

# 19. Controle de acessos

Vincular RH ao provisionamento/desprovisionamento de acessos.

- Usuário
- E-mail corporativo
- Perfil
- Grupo
- Departamento
- Sistemas autorizados
- Data de criação
- Data de bloqueio
- Status
- Último acesso

## Regra recomendada

Na admissão:

```text
Colaborador admitido
        ↓
Criar acessos
        ↓
Atribuir perfil
        ↓
Enviar credenciais por processo seguro
```

No desligamento:

```text
Desligamento
        ↓
Bloquear acessos
        ↓
Cancelar benefícios
        ↓
Solicitar devolução de equipamentos
        ↓
Concluir checklist
```

---

# 20. Férias

Mesmo que o módulo seja separado, o cadastro deve permitir o relacionamento.

- Período aquisitivo
- Início
- Fim
- Dias de direito
- Dias gozados
- Dias vendidos
- Abono
- Férias programadas
- Férias realizadas
- Saldo
- Observações

---

# 21. Afastamentos

- Tipo
- Motivo
- Data inicial
- Data final
- Previsão de retorno
- Dias
- Documento
- Arquivo
- Observações
- Impacto na folha
- Impacto em benefícios

---

# 22. Ponto

Relacionar colaborador ao módulo de ponto.

- Relógio
- Identificador
- PIS
- Tipo de marcação
- Jornada
- Escala
- Banco de horas
- Tolerância
- Local de marcação
- Status

---

# 23. Avaliação de desempenho

Criar módulo separado, mas vinculado ao colaborador.

## Avaliação

- Ciclo
- Período
- Avaliador
- Nota
- Competências
- Pontos fortes
- Pontos de melhoria
- Metas
- Feedback
- Plano de desenvolvimento
- Data
- Status

---

# 24. Histórico profissional

Permitir registrar experiências anteriores.

- Empresa
- Cargo
- Função
- Data de início
- Data de término
- Último salário
- Motivo da saída
- Descrição das atividades
- Observações

---

# 25. Advertências e medidas disciplinares

Área com permissão restrita.

- Tipo
- Data
- Motivo
- Descrição
- Responsável
- Documento
- Arquivo
- Status
- Observações

Exemplos:

- Advertência verbal
- Advertência escrita
- Suspensão
- Outras medidas

---

# 26. Reconhecimentos e ocorrências positivas

Também registrar eventos positivos:

- Premiação
- Bonificação
- Reconhecimento
- Certificação
- Promoção
- Destaque
- Mérito
- Participação em projetos

---

# 27. Desligamento

Mesmo que o processo fique em outro módulo, já criar a estrutura.

- Data do desligamento
- Último dia trabalhado
- Motivo
- Tipo de desligamento
- Aviso prévio
- Data do aviso
- Exame demissional
- Status da rescisão
- Documentos
- Homologação
- Data da homologação
- Devolução de equipamentos
- Cancelamento de benefícios
- Bloqueio de acessos
- Entrevista de desligamento
- Observações

---

# 28. Checklist de desligamento

```text
☐ Aviso prévio
☐ Comunicação interna
☐ Exame demissional
☐ Rescisão
☐ Documentação
☐ Devolução de equipamentos
☐ Devolução de crachá
☐ Cancelamento de benefícios
☐ Bloqueio de acessos
☐ Encerramento de contas
☐ Entrevista de desligamento
☐ Arquivamento
```

---

# 29. Histórico geral do colaborador

Esta é uma das partes mais importantes.

Criar uma timeline.

## Exemplos

```text
06/09/2026
Admissão

06/09/2026
Cargo: Desenvolvedor Júnior

06/09/2026
Salário: R$ 3.000,00

10/01/2027
Alteração salarial: R$ 3.500,00

15/03/2027
Promoção para Desenvolvedor Pleno

20/07/2027
Mudança de departamento

01/09/2027
Novo gestor
```

Registrar sempre:

- Tipo de evento
- Data
- Dados anteriores
- Dados novos
- Usuário
- Motivo
- Observação

---

# 30. Auditoria

O sistema de RH deve ter uma trilha de auditoria.

## Registrar

- Usuário
- Data
- Hora
- IP
- Ação
- Módulo
- Registro afetado
- Campo alterado
- Valor anterior
- Valor novo
- Origem
- User Agent, quando aplicável

## Exemplos de eventos

- Cadastro criado
- Cadastro alterado
- Documento enviado
- Documento excluído
- Salário alterado
- Benefício incluído
- Benefício removido
- Cargo alterado
- Acesso criado
- Acesso bloqueado
- Desligamento iniciado

---

# 31. Permissões e segurança

Dados de RH não devem estar disponíveis para qualquer usuário.

## Perfis sugeridos

### Administrador

Acesso completo.

### RH

Acesso aos dados de colaboradores.

### Departamento Pessoal

Acesso a:

- Admissão
- Contratos
- Folha
- Benefícios
- Férias
- Afastamentos

### Gestor

Acesso somente aos colaboradores da sua estrutura.

### Colaborador

Acesso somente aos próprios dados permitidos.

### SST

Acesso aos dados necessários de saúde ocupacional.

### Auditor

Acesso somente para consulta e auditoria.

---

# 32. LGPD e privacidade

Separar informações por nível de sensibilidade.

## Dados cadastrais

- Nome
- CPF
- Endereço
- Contato

## Dados financeiros

- Salário
- Banco
- Conta
- Benefícios
- Empréstimos

## Dados potencialmente sensíveis

- Saúde
- Deficiência
- Informações biométricas, quando utilizadas
- Outros dados enquadrados como sensíveis pela legislação

## Recomendações

- Controle de acesso por perfil
- Criptografia em trânsito
- Criptografia em repouso quando apropriado
- Logs de acesso
- Auditoria
- Controle de download
- Política de retenção
- Backup
- Exclusão segura
- Histórico de consentimentos quando aplicável
- Não coletar informação sem finalidade definida

---

# 33. Estrutura de banco de dados recomendada

Evitar:

```text
colaboradores
+ 150 colunas
```

Preferir entidades relacionadas.

```text
colaboradores
├── enderecos
├── contatos
├── documentos
├── contratos
├── cargos
├── lotacoes
├── historico_cargos
├── historico_salarios
├── jornadas
├── historico_jornadas
├── dados_bancarios
├── beneficios
├── colaborador_beneficios
├── dependentes
├── formacoes
├── cursos
├── certificacoes
├── competencias
├── colaborador_competencias
├── documentos_admissao
├── contratos_assinaturas
├── equipamentos
├── colaborador_equipamentos
├── acessos
├── ferias
├── afastamentos
├── ponto
├── avaliacoes
├── advertencias
├── reconhecimentos
├── desligamentos
├── historico_colaborador
└── auditoria
```

---

# 34. Entidade principal — colaboradores

Exemplo conceitual:

```sql
colaboradores
-------------
id
empresa_id
matricula
nome_completo
nome_social
cpf
data_nascimento
sexo
estado_civil
nacionalidade
naturalidade
uf_nascimento
nome_mae
nome_pai
grau_instrucao
foto_url
status
data_admissao
data_desligamento
created_at
updated_at
deleted_at
```

> Campos devem ser adaptados ao banco, às regras do produto e às integrações necessárias.

---

# 35. Relacionamentos principais

```text
EMPRESA
   │
   └── COLABORADOR
         │
         ├── ENDEREÇOS
         ├── CONTATOS
         ├── DOCUMENTOS
         ├── CONTRATOS
         ├── CARGOS
         ├── LOTAÇÕES
         ├── SALÁRIOS
         ├── JORNADAS
         ├── BENEFÍCIOS
         ├── DEPENDENTES
         ├── FORMAÇÃO
         ├── CURSOS
         ├── CERTIFICAÇÕES
         ├── COMPETÊNCIAS
         ├── SST
         ├── DOCUMENTOS DE ADMISSÃO
         ├── ASSINATURAS
         ├── EQUIPAMENTOS
         ├── ACESSOS
         ├── FÉRIAS
         ├── AFASTAMENTOS
         ├── PONTO
         ├── AVALIAÇÕES
         ├── ADVERTÊNCIAS
         ├── RECONHECIMENTOS
         ├── HISTÓRICO
         └── DESLIGAMENTO
```

---

# 36. Tela de admissão recomendada

A admissão não deveria ser uma tela gigantesca.

Utilizar um wizard:

```text
1. Dados pessoais
        ↓
2. Endereço
        ↓
3. Documentos
        ↓
4. Contrato
        ↓
5. Cargo e lotação
        ↓
6. Salário
        ↓
7. Jornada
        ↓
8. Benefícios
        ↓
9. Dependentes
        ↓
10. Documentos da admissão
        ↓
11. Assinaturas
        ↓
12. Revisão
        ↓
13. Finalizar admissão
```

---

# 37. Tela de revisão antes da admissão

Antes de finalizar, mostrar:

## Dados pessoais

Nome, CPF, nascimento e contatos.

## Contrato

Cargo, salário, jornada, empresa, filial e data de admissão.

## Benefícios

Lista de benefícios escolhidos.

## Dependentes

Lista de dependentes.

## Documentos

Quantidade de documentos:

```text
8 obrigatórios
7 recebidos
1 pendente
```

## Pendências

Exemplo:

```text
⚠ Comprovante bancário pendente
⚠ ASO aguardando aprovação
```

Não permitir conclusão quando existir documento ou informação obrigatória pendente, salvo quando o fluxo administrativo permitir exceção com justificativa e auditoria.

---

# 38. Dashboard do colaborador

Ao abrir o cadastro:

```text
┌───────────────────────────────────────────┐
│ FOTO  João da Silva                      │
│ Desenvolvedor Pleno                      │
│ Matrícula: 00125                         │
│ Status: ATIVO                            │
└───────────────────────────────────────────┘

Cargo: Desenvolvedor Pleno
Departamento: Tecnologia
Gestor: Maria
Admissão: 06/09/2026
Salário: R$ 5.000,00

Benefícios
[VR] [VA] [Plano de Saúde]

Documentos
8/8 completos

Férias
30 dias disponíveis

Afastamentos
Nenhum

Pendências
1 documento

Últimas alterações
...
```

---

# 39. Indicadores úteis

No dashboard do RH:

- Total de colaboradores
- Admissões no mês
- Desligamentos no mês
- Colaboradores em experiência
- Documentos pendentes
- Documentos vencendo
- ASOs vencendo
- Férias próximas
- Benefícios ativos
- Dependentes
- Aniversariantes
- Colaboradores por departamento
- Colaboradores por cargo
- Colaboradores por filial
- Turnover
- Tempo médio de empresa

---

# 40. Validações importantes

## CPF

- Formato
- Dígitos verificadores
- CPF duplicado

## E-mail

- Formato
- Duplicidade quando necessário

## CEP

- Formato
- Busca de endereço

## Datas

Validar:

```text
data_admissao >= data_nascimento
data_desligamento >= data_admissao
fim_contrato >= inicio_contrato
fim_experiencia >= inicio_experiencia
```

## Salário

- Não aceitar valores inválidos
- Histórico obrigatório em alterações

## Documentos

- CPF único, quando aplicável
- Número de documento
- Validade
- Arquivo seguro

---

# 41. Automação da admissão

Uma admissão completa pode disparar automaticamente:

```text
Nova admissão
      ↓
Criar matrícula
      ↓
Criar contrato
      ↓
Vincular cargo
      ↓
Vincular departamento
      ↓
Configurar jornada
      ↓
Cadastrar benefícios
      ↓
Cadastrar dependentes
      ↓
Criar checklist
      ↓
Gerar documentos
      ↓
Solicitar assinaturas
      ↓
Criar tarefas de TI
      ↓
Criar acessos
      ↓
Registrar auditoria
      ↓
Colaborador ATIVO
```

---

# 42. Regras importantes de arquitetura

## Não sobrescrever histórico

Exemplo:

```text
ERRADO:

colaborador.salario = 5000
```

Preferir:

```text
historico_salarios
01/01/2026 → R$ 4000
01/07/2026 → R$ 5000
```

## Não excluir dados históricos fisicamente sem política definida

Preferir:

- Soft delete quando apropriado
- Status
- Data de encerramento
- Auditoria

## Não duplicar cadastros

Exemplo:

```text
beneficio
    ↓
colaborador_beneficio
```

Em vez de:

```text
colaborador.vale_refeicao
colaborador.vale_alimentacao
colaborador.plano_saude
...
```

---

# 43. Campos obrigatórios x opcionais

Uma boa prática é configurar a obrigatoriedade por:

- Empresa
- Tipo de colaborador
- Cargo
- País
- Tipo de contrato
- Processo

Exemplo:

```text
CPF → obrigatório
Nome → obrigatório
Data de nascimento → obrigatório
Endereço → obrigatório
Banco → obrigatório para folha
CNH → obrigatório somente para motorista
Registro profissional → obrigatório para determinados cargos
ASO → obrigatório conforme processo de SST
```

---

# 44. Cadastro mínimo para admitir

Para não tornar a admissão inviável, separar:

## Obrigatório para iniciar

- Nome
- CPF
- Data de nascimento
- Contato
- Endereço
- Empresa
- Filial
- Cargo
- Departamento
- Data de admissão
- Tipo de contrato
- Salário
- Jornada

## Obrigatório antes de finalizar

- Documentação obrigatória
- Contrato
- Informações exigidas pelo processo
- Benefícios definidos
- Dados bancários quando necessários
- Exames/documentos obrigatórios

---

# 45. Checklist final de implementação

## Cadastro

- [ ] Dados pessoais
- [ ] Contatos
- [ ] Endereço
- [ ] Documentos
- [ ] Dependentes
- [ ] Formação
- [ ] Competências

## Admissão

- [ ] Empresa
- [ ] Filial
- [ ] Cargo
- [ ] Função
- [ ] CBO
- [ ] Departamento
- [ ] Centro de custo
- [ ] Gestor
- [ ] Salário
- [ ] Jornada
- [ ] Contrato
- [ ] Experiência

## Benefícios

- [ ] VT
- [ ] VR
- [ ] VA
- [ ] Saúde
- [ ] Odonto
- [ ] Seguro
- [ ] Benefícios personalizados

## Documentos

- [ ] Checklist
- [ ] Upload
- [ ] Validade
- [ ] Aprovação
- [ ] Assinatura digital
- [ ] Histórico

## Gestão

- [ ] Ponto
- [ ] Férias
- [ ] Afastamentos
- [ ] Avaliações
- [ ] Treinamentos
- [ ] Advertências
- [ ] Reconhecimentos
- [ ] Equipamentos
- [ ] Acessos

## Segurança

- [ ] Perfis
- [ ] Permissões
- [ ] Auditoria
- [ ] Logs
- [ ] Controle de acesso
- [ ] Proteção de dados
- [ ] Backup
- [ ] Retenção
- [ ] Exclusão segura

## Desligamento

- [ ] Aviso
- [ ] Rescisão
- [ ] Exame
- [ ] Benefícios
- [ ] Equipamentos
- [ ] Acessos
- [ ] Documentos
- [ ] Entrevista
- [ ] Auditoria

---

# 46. Resultado esperado

Ao final, o sistema deverá permitir que cada colaborador possua um **dossiê digital completo**, com:

```text
DADOS PESSOAIS
    +
CONTRATO
    +
CARGO
    +
SALÁRIO
    +
JORNADA
    +
BENEFÍCIOS
    +
DEPENDENTES
    +
DOCUMENTOS
    +
FORMAÇÃO
    +
SST
    +
EQUIPAMENTOS
    +
ACESSOS
    +
PONTO
    +
FÉRIAS
    +
AFASTAMENTOS
    +
AVALIAÇÕES
    +
HISTÓRICO
    +
DESLIGAMENTO
    +
AUDITORIA
```

A estrutura deve ser modular, permitindo que novas funcionalidades sejam adicionadas sem alterar drasticamente o cadastro principal do colaborador.
