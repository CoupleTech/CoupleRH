# Log de Decisões (Decision Log / ADR)

Registro das decisões arquiteturais e de negócio para o projeto.

### 04/09/2026 - Decisão de Base Tecnológica
- **Decisão**: Utilizar React, Tailwind CSS V4, Supabase (BaaS) e Hospedagem na Vercel.
- **Justificativa**: Velocidade de iteração no frontend, escalabilidade do backend sem necessidade de infraestrutura pesada inicial, forte segurança com Row Level Security (RLS) oferecida pelo Supabase. O Tailwind CSS e Vite possibilitam a interface "premium" e moderna exigida.

### 04/09/2026 - Arquitetura de Software
- **Decisão**: Monólito Modular.
- **Justificativa**: Sistemas de DP possuem altíssimo acoplamento de negócios (ex: Férias impactam a folha, que impacta eSocial e FGTS). Microserviços prematuros gerariam problemas graves de transação distribuída em operações financeiras e legais.

### [Pendente] - Decisão do provedor de Assinatura Eletrônica
- **Problema**: Precisamos definir como contratos e holerites serão assinados legalmente.
