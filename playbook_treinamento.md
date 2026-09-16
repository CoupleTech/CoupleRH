# 🚀 Playbook Oficial de Treinamento e Implantação

Bem-vindo ao guia definitivo de uso e implantação do **coupleRH**.
Este material foi desenhado para ser o **roteiro exato** que um Analista de RH deve seguir ao parametrizar um novo cliente no sistema. Além do passo a passo técnico, incluímos o **propósito de cada módulo**, para que você compreenda *por que* estamos cadastrando cada informação e como o Motor de Folha as utiliza.

---

## 🛑 PASSO 0: O Ambiente Limpo (Hard Reset)
**💡 Propósito do Módulo:** Garantir que o ambiente de treinamento não sofra interferências de testes anteriores.
Se você está em um ambiente de testes e deseja começar do zero absoluto para uma simulação real:
1. Abra o painel do seu banco de dados (Supabase SQL Editor local).
2. Cole e execute o arquivo `supabase/scripts/truncate_all.sql`.
3. Pronto! O banco estará zerado (todas as tabelas transacionais apagadas), mantendo apenas a infraestrutura base.

---

## 🏢 PASSO 1: Estrutura Organizacional
**💡 Propósito do Módulo:** É a fundação do sistema. Antes de contratar alguém, a empresa precisa existir fisicamente e estruturalmente. O Motor de Cálculo e o eSocial usarão essas amarrações para gerar relatórios e guias de impostos corretas.

### 1.1 Configuração da Empresa Principal
**Tela:** `Configurações > Empresas`
- Clique em **"+ Nova Empresa"**.
- **Razão Social:** `CoupleRH Tecnologia LTDA`
- **Nome Fantasia:** `CoupleRH`
- **CNPJ:** `12.345.678/0001-99`
- *Treinamento:* Explique que o sistema é Multi-Tenant. Esta tela define a "Matriz", cujos dados sairão no cabeçalho dos holerites.

### 1.2 Departamentos
**Tela:** `Organização > Departamentos`
- **Depto 1:** `Tecnologia` (Código: 001)
- **Depto 2:** `Administrativo` (Código: 002)
- *Treinamento:* Departamentos são os "guarda-chuvas" macro da empresa, usados em relatórios de folha e contabilização.

### 1.3 Setores
**Tela:** `Organização > Setores`
- **Setor 1:** `Desenvolvimento` (Vincular à Tecnologia)
- **Setor 2:** `Recursos Humanos` (Vincular ao Administrativo)
- *Treinamento:* Setores representam a divisão operacional real de onde o funcionário atua diariamente.

### 1.4 Cargos (Roles / Positions)
**Tela:** `Organização > Cargos`
- **Cargo 1:** `Desenvolvedor Júnior` (CBO: 3171-10)
- **Cargo 2:** `Analista de RH` (CBO: 4110-05)
- **Cargo 3:** `Diretor de Tecnologia` (CBO: 1236-05)
- **Cargo 4:** `Assistente Administrativo` (CBO: 4110-10)
- *Treinamento:* O Cargo é obrigatório para o eSocial. O código CBO (Classificação Brasileira de Ocupações) mapeia a profissão do colaborador para o Ministério do Trabalho.

### 1.5 Centros de Custo
**Tela:** `Organização > Centros de Custo`
- **Centro 1:** `Desenvolvimento de Software` (Código: DEV-01)
- **Centro 2:** `Administração Geral` (Código: ADM-01)
- *Treinamento:* Mostre que o Centro de Custo é o coração da integração com o Sistema Financeiro/ERP. A folha de pagamento será "rateada" baseada nesses códigos.

### 1.6 Locais de Trabalho (Workplaces)
**Tela:** `Organização > Locais`
- **Local 1:** `Matriz - SP` (Endereço completo da sede)
- **Local 2:** `Trabalho Remoto / Home Office`
- *Treinamento:* Essencial para regras de Medicina e Segurança do Trabalho (SST). O local dita onde o funcionário está exposto a riscos físicos.

### 1.7 Tipos de Contrato (⚠️ Impacto Direto no Motor)
**Tela:** `Organização > Tipos de Contrato`
O Tipo de Contrato dita as **regras do jogo** para o Motor de Cálculo. A seção *Direitos e Incidências* define o que o robô deve ou não processar.

- **Tipo 1: CLT Padrão** (Categoria Legal: CLT)
  - *Incidências:* **Marcar TUDO** (FGTS, INSS, Direito a 13º, Direito a Férias).
- **Tipo 2: Estágio** (Categoria Legal: Estagiário)
  - *Incidências:* **Desmarcar TUDO** (Estagiário não desconta INSS, não tem FGTS patronal, não tem 13º. O "recesso" é calculado diferente das férias CLT).
- **Tipo 3: Pró-Labore / Sócio** (Categoria Legal: Contribuinte Individual)
  - *Incidências:* **Marcar apenas INSS** (Diretores estatutários geralmente não têm FGTS, 13º ou Férias, apenas o INSS sobre a retirada).

*Treinamento:* Frise que se a caixinha "Incidência de INSS" estiver desmarcada no contrato, o Motor de Cálculo **nunca** fará o desconto na folha, não importa o quanto o funcionário ganhe. Essa tela dá flexibilidade extrema ao RH.

---

## ⚙️ PASSO 2: Parâmetros e Jornadas
**💡 Propósito do Módulo:** É aqui que configuramos as "Fórmulas da Matemática". O sistema precisa saber o que é tributado, quantas horas a pessoa trabalha no mês e quais benefícios recebe, para transformar tempo em dinheiro.

### 2.1 Escalas de Trabalho
**Tela:** `Tempo e Presença > Escalas de Trabalho`
- **Nome:** `Comercial Padrão 44h` | **Tipo:** `Semanal`
- **Horários:** Segunda a Sexta, `08:00` às `12:00` e `13:00` às `18:00`. Sábado e Domingo como `DSR/Folga`.
- *Treinamento:* A escala diz ao motor qual é o divisor de horas (Ex: 220h) para encontrar o "valor da hora" do funcionário ao calcular atrasos e horas extras.

### 2.2 Tabelas Legais (INSS e IRRF)
**Tela:** `Parâmetros > Tabelas Legais`
- Verifique se o **Teto do INSS** está correto (Ex: R$ 8.475,55).
- Verifique a **Tabela Progressiva de IRRF** e o valor da **Dedução por Dependente**.
- *Treinamento:* A folha muda todo ano de acordo com o Governo. Em vez de atualizarmos o sistema via código, o próprio RH atualiza os tetos e percentuais por esta tela.

### 2.3 Rubricas da Folha (O Coração do Motor)
**Tela:** `Folha de Pagamento > Rubricas`

As rubricas são as famosas "linhas do holerite". No **coupleRH**, a rubrica não é apenas um texto e um valor; ela é uma **regra matemática parametrizada**. 

**💡 Como o Motor de Folha interpreta as Rubricas?**
Não se preocupe com nomes ou códigos internos (ex: 101, 1001). O Motor de Cálculo não tenta "adivinhar" pelo nome se a rubrica é de Salário ou de Imposto. Ele utiliza **3 pilares estruturais** para entender a matemática:
1. **Categoria Contábil:** Define a família da rubrica (ex: Salários, Horas Extras, Tributos).
2. **Ordem de Processamento:** O motor calcula em degraus. O Salário (Ordem 10) tem que ser calculado antes do INSS (Ordem 50), que vem antes do IRRF (Ordem 60).
3. **Natureza eSocial:** É o "CPF" da rubrica. É por este código oficial (como 9201 para INSS) que o robô (e o governo) sabem exatamente qual tabela legal aplicar.

---
#### Entendendo as Abas de Cadastro (Campo a Campo)

Para cadastrar ou revisar uma rubrica, você navegará por 3 abas principais:

**Aba 1: Dados Básicos**
*   **Código:** Numeração interna livre do seu RH (ex: 1001 para Salário, 2001 para INSS). O sistema não usa isso para cálculos, serve apenas para organizar relatórios.
*   **Nome da Rubrica:** O texto exato que será impresso no Recibo de Pagamento (Holerite) do funcionário.
*   **Natureza (Tipo):** Define a operação matemática básica:
    *   `Provento (+) Ganhos`: Dinheiro que entra (Salários, Horas Extras).
    *   `Desconto (-) Retenções`: Dinheiro que sai (INSS, IRRF, Faltas, Vale Transporte).
    *   `Base de Cálculo (=) Informativo`: Valores que não somam nem subtraem do líquido, mas precisam aparecer no holerite (ex: FGTS do Mês).
*   **Categoria Contábil:** Define de qual grupo a rubrica faz parte. Se for INSS ou IRRF, usamos `Tributos e Encargos`. Se for vale transporte, usamos `Benefício`.
*   **Origem:** Se o valor for digitado à mão todo mês (ex: Comissões), use `Manual`. Se o sistema tiver que calcular usando tabelas (ex: INSS) ou importar (ex: Ponto), use `Automática`.

**Aba 2: Motor de Cálculo**
*   **Ordem de Processamento:** A regra de ouro é a cascata. 
    *   `1 a 20`: Proventos Básicos (Salário Base, Faltas, Horas Extras).
    *   `21 a 49`: Reflexos e Benefícios (DSR, Descontos de VT/VR).
    *   `50 a 69`: Tributos (50 para INSS, 60 para IRRF).
    *   `70+`: Informativos (FGTS).
*   **Modo de Processamento:** Se for um imposto, marque opções como `Fórmula` ou `Tabela Legal`. Se for um desconto fixo de plano de saúde, use `Valor Fixo`.

**Aba 3: Incidências e Bases (Atenção aos Passivos!)**
A regra fundamental é: *Imposto não paga imposto*.
*   **Incidências de Tributos (Empregado):** Se a rubrica for um "Ganhos" (ex: Salário Base, Hora Extra), você **marca** as caixinhas de INSS, IRRF e FGTS, para o motor somar esse dinheiro na hora de cobrar o imposto. Se a rubrica for um "Desconto" (ex: Faltas, INSS, VT), você **deixa desmarcado**.
*   **Código Natureza eSocial (Tabela 3):** O campo mais importante para o compliance. O eSocial obriga que cada rubrica tenha um código oficial. Exemplos: `1000` (Salário), `9201` (INSS), `9203` (IRRF), `9213` (Faltas).

---
**Exercício de Treinamento:**
Peça para o usuário cadastrar/revisar as seguintes rubricas essenciais para o laboratório:
1. `Salário Base` (Ordem 1, Provento, Incide Tudo, eSocial 1000) - **IMPORTANTE:** Preencher a Base de Cálculo como `SALARIO_BASE`.
2. `Horas Extras 50%` (Ordem 10, Provento, Incide Tudo, eSocial 1004) - **IMPORTANTE:** Preencher a Base de Cálculo como `SALARIO_BASE`.
3. `Faltas Injustificadas` (Ordem 15, Desconto, Não Incide, eSocial 9213)
4. `Desconto Vale Transporte` e `Vale Refeição` (Ordem 40 e 41, Descontos, Não Incide, eSocial 9216 e 9217)
5. `INSS` e `IRRF` (Ordem 50 e 60, Descontos, Não Incide, eSocial 9201 e 9203)
6. `FGTS Mensal` (Ordem 70, Informativo, Não Incide, eSocial 9908)
7. `Adiantamento Quinzenal` (Ordem 5, Provento, Não Incide, Categoria: Adiantamento) - **IMPORTANTE:** Essencial para conseguir gerar a folha de adiantamento.

*É obrigatório criá-las nesta etapa, pois os cálculos das próximas fases dependem totalmente delas.*

### 2.4 Catálogo de Benefícios
**Tela:** `Benefícios > Catálogo`
- **Vale Refeição (VR)**: Tipo "Desconto", subsidiado pela empresa (ex: 20% desconto em folha). Vincule à rubrica `Desconto Vale Refeição` recém-criada.
- **Vale Transporte (VT)**: Tipo "Desconto", limite legal de `6%` sobre o salário base. Vincule à rubrica `Desconto Vale Transporte`.
- *Treinamento:* Mostre como a parametrização do benefício automatiza o desconto sem precisar que o RH digite valores manuais todo mês, pois ele usa a Rubrica (criada no passo anterior) como ponte para o Motor de Cálculo.

---

## 👥 PASSO 3: O Cadastro de Funcionários (Personas)
**💡 Propósito do Módulo:** É o cruzamento dos dados. Aqui, pegamos as Pessoas físicas e as vinculamos à Estrutura (Passo 1) e aos Parâmetros (Passo 2). 

Vamos criar 4 Personas para forçar o Motor de Cálculo a pensar em cenários difíceis:

### 🧑‍💻 Persona 1: João (O Básico)
- **Vínculo:** CLT Padrão | Desenvolvedor Júnior | Escala 44h.
- **Diferencial:** R$ 3.000,00 **sem dependentes**.
- *Treinamento:* Usado para provar que a matemática limpa do sistema está exata (IRRF Simplificado e INSS seco).

### 👩‍💼 Persona 2: Maria (A Operacional)
- **Vínculo:** CLT Padrão | Analista de RH | Escala 44h.
- **Diferencial:** R$ 4.500,00 **com 2 Filhos**. (Na aba Dependentes, marque a opção de dedução de IRRF).
- *Treinamento:* Usada para testar o DSR e provar que o Motor é inteligente para abater o imposto de renda pelo número de filhos, caso seja mais vantajoso.

### 🤵 Persona 3: Carlos (O Executivo)
- **Vínculo:** Pró-Labore / Diretor | Diretor de Tecnologia.
- **Diferencial:** R$ 15.000,00 **sem dependentes**.
- *Treinamento:* Usado para validar a "Trava de Teto" do INSS (o sistema deve parar de descontar assim que atingir o valor limite estabelecido no Passo 2.2).

### 👩‍🏫 Persona 4: Ana (A Afastada/Férias)
- **Vínculo:** CLT Padrão | Assistente Administrativa.
- **Diferencial:** R$ 4.000,00. Terá um afastamento / férias programado.
- *Treinamento:* Usada para demonstrar a "Proporcionalidade". O motor deve pagar apenas os dias trabalhados.

---

## 📝 PASSO 4: Eventos e Lançamentos Variáveis
**💡 Propósito do Módulo:** O salário base é fixo, mas a vida não. Este módulo serve para registrar as exceções do mês (atrasos, faltas, bônus, horas extras).

**Tela:** `Folha de Pagamento > Eventos` e `Módulo de Férias`
1. **Lançamento da Maria:** Adicione manualmente um evento de `Horas Extras 50%` com referência de `10 horas` no mês vigente.
2. **Férias da Ana:** Vá em `Departamento Pessoal > Férias` e programe férias para Ana do dia 1 ao 15. Ao salvar, selecione "Gerar Recibo e Enviar para o Motor de Folha".

---

## 💸 PASSO 5: O Processamento (A Hora da Verdade)
**💡 Propósito do Módulo:** Onde o robô pega todas as variáveis, matrizes, rubricas, incidências dos tipos de contratos e gera a folha de pagamento em milissegundos.

**Tela:** `Folha de Pagamento > Cálculos`
1. Processe uma **Folha de Adiantamento** (Dia 15). O sistema aplicará a taxa de adiantamento (ex: 40%) sem tributar INSS/IRRF.
2. Processe a **Folha Mensal** (Dia 30/31). O sistema vai consolidar o salário líquido final abatendo o adiantamento.

---

## 🕵️‍♂️ PASSO 6: A Auditoria Transparente (O Check-out)
**💡 Propósito do Módulo:** Transparência total. É a arma de vendas do sistema: permitir que o analista saiba o motivo exato de cada centavo sem precisar de planilhas.

Para cada Persona, abra a folha Mensal, clique no holerite e desça até o botão **"Ver Memória de Cálculo"**:

1. **Memória do João:**
   - Mostre como o INSS somou as 3 faixas da tabela. Mostre a dedução simplificada (Ex: R$ 607,20) sendo aplicada no IRRF.
2. **Memória da Maria:**
   - Mostre que o sistema calculou as Horas Extras baseadas no divisor 220 da escala dela. Mostre a criação automática da rubrica de DSR sobre as horas extras.
3. **Memória do Carlos:**
   - Abra a linha do INSS. O robô da folha registrou a trava do Teto, descontando exatamente o limite legal, provando que o Tipo de Contrato cometeu a incidência corretamente, mas respeitou a tabela.
4. **Memória da Ana:**
   - O recibo demonstrará o saldo de salário proporcional (15 dias). O saldo restante está protegido dentro da folha do Recibo de Férias.

---

## 🔐 PASSO 7: Fechamento Contábil
**Tela:** `Folha de Pagamento > Cálculos`
- Mude o status da folha para **"FECHADA"**.
- *Treinamento:* Tente editar a hora extra da Maria e volte na folha. Nada muda. Explique que o Fechamento gera um *Snapshot Imutável*, garantindo compliance contábil e prevenindo desastres operacionais.
