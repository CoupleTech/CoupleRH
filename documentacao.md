# Documentação Central - coupleRH

## 1. Escopo do Projeto
O sistema **coupleRH** é uma plataforma SaaS/PWA responsiva, com a finalidade de administrar Recursos Humanos e Departamento Pessoal de empresas brasileiras regidas pela CLT.
A plataforma deve gerenciar vínculos trabalhistas, documentos, jornadas, folha de pagamento, férias, benefícios, rescisões, eSocial e SST.

## 2. Regras de Negócio Fundamentais
- **Conformidade Legal**: Nunca inventar regras, usar CLT e manuais oficiais.
- **Rastreabilidade**: Tudo deve ter versão, vigência, origem de alteração.
- **Auditoria**: Toda ação sensível deve gerar trilha imutável.
- **Multiempresa**: Isolamento estrito entre tenants, empresas e estabelecimentos (RLS no Supabase).
- **Tratamento de Dados (LGPD)**: Proteção de dados sensíveis e médicos, limitação de acesso de gestores a CID e atestados restritos.

## 3. Decisões Técnicas e Stack
- **Frontend**: React.js / Next.js com TailwindCSS + Shadcn/UI, focando em UX excepcional (Design System próprio, glassmorphism, microinterações).
- **Backend / BaaS**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security - RLS).
- **Hospedagem Frontend**: Vercel (Gratuito inicial).
- **Segurança**: Políticas RLS muito rigorosas, criptografia para dados de saúde, soft-delete para registros operacionais.

## 4. Evolução do Sistema (Histórico)
- **Fase Inicial**: Setup do projeto e autenticação básica.
- **Refatoração (Colaboradores)**: O fluxo de Onboarding foi removido. Colaboradores agora são cadastrados diretamente quando aprovados, simplificando a tela de listagem para exibição apenas dos ativos.
- **04/09/2026**: Inicialização do projeto, criação dos artefatos básicos de gestão (fase.md, documentacao.md, database.md), e definição da stack tecnológica (React + Supabase + Vercel).
