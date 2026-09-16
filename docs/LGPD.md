# Privacidade e Proteção de Dados (LGPD)

O sistema RH manipula dados Pessoais e Pessoais Sensíveis de forma constante. A arquitetura foi concebida sob o prisma *Privacy by Design*.

### 1. Inventário e Base Legal (RoPA)
Em vez de tratar o "Consentimento" como passe livre (o que é incorreto na área trabalhista), o sistema classifica o motivo da coleta:
- **Obrigação Legal**: Ex: CPF, CTPS, Dependentes para IRRF (Base: eSocial e CLT). O funcionário não precisa consentir, pois a lei exige a coleta.
- **Execução de Contrato**: Ex: Dados bancários para pagamento de salário.
- **Consentimento**: Ex: Uso de biometria facial para catraca, ou adesão voluntária a um Plano de Saúde estendido.
Esses controles são persistidos na tabela `lgpd_consents`.

### 2. Retenção e Descarte Automático (Data Lifecycle)
O DP é obrigado a guardar documentos, mas não para sempre. A tabela `data_retention_policies` orienta o sistema de descarte:
- Dados de saúde ocupacional (ASO, PPP): Guardados por até 20/30 anos, conforme lei previdenciária.
- Banco de Horas e recibos normais: Prescrição trabalhista de 5 anos.
- Exclusão de candidatos rejeitados no Onboarding: Descarte após 6 meses (configurável).

### 3. Segregação de Dados Sensíveis (Saúde)
Diagnósticos Médicos (CID) contidos em Atestados e Exames ASO possuem tratamento rigoroso de acesso. O gestor direto do funcionário é impedido de ver o "porquê" (a doença) do afastamento, recebendo do sistema apenas a notificação de "Afastamento Médico Aprovado: de X a Y". Apenas os papéis `Médico do Trabalho` e `Administrador DP` possuem acesso irrestrito à coluna `result` e `certificate_url` da tabela `sst_health_exams`.

### 4. Direito ao Esquecimento e Pseudo-Anonimização
Devido a restrições legais (como recolhimento de impostos ou prestação de contas à Caixa), um funcionário demitido não pode ser simplesmente "apagado" (`DELETE`) do banco de dados (Soft Delete ou Hard Delete direto).
Ao acionar a "Exclusão LGPD", o sistema aplica **pseudonimização**:
- Mascara campos como nome (ex: `J*** S***`), endereço e e-mail.
- Preserva o UUID e os cálculos numéricos para integridade do banco e reprocessamento histórico.
- Apaga anexos não essenciais (ex: foto de perfil).
