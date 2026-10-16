-- Migration: 00102_rbac_granular_roles_and_permissions_p8
-- Description: Implementação de RBAC granular (DP, gestor, contador, auditor, colaborador) e fortalecimento das políticas RLS multitenant.

-- 1. Atualizar Constraint de Roles e Adicionar worker_id em tenant_users
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_role_check 
    CHECK (role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'accountant', 'auditor', 'employee', 'sst_specialist'));

ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL;

-- 2. Expandir Catálogo de Permissões Granulares
INSERT INTO public.permissions (slug, name, module, description) VALUES
('manage_users', 'Gerenciar Usuários e Perfis', 'Configurações', 'Criar usuários e perfis de acesso'),
('manage_settings', 'Configurações Globais', 'Configurações', 'Alterar preferências do sistema e cadastros organizacionais'),
('manage_employees', 'Gestão de Funcionários', 'RH', 'Cadastrar e editar dados de colaboradores e contratos'),
('view_team_employees', 'Visualizar Colaboradores da Equipe', 'RH', 'Consultar dados e escalas dos colaboradores da equipe ou departamento'),
('manage_payroll', 'Folha de Pagamento', 'DP', 'Calcular folha, lançar eventos, férias e rescisões'),
('view_payroll_accounting', 'Visualização Contábil da Folha', 'DP', 'Acesso a resumos contábeis D=C, provisões de férias/13º e guias tributárias DCTFWeb/FGTS/DARF'),
('export_financial_reports', 'Exportação de Guias e CNAB', 'Financeiro', 'Exportar arquivos bancários CNAB 240, guias de recolhimento e relatórios contábeis'),
('manage_time_tracking', 'Gestão Completa de Ponto Eletrônico', 'Ponto', 'Configurar dispositivos, importar AFD, tratar ocorrências e fechar espelhos'),
('manage_team_time_tracking', 'Gestão de Ponto da Equipe', 'Ponto', 'Visualizar e aprovar espelhos e compensações de ponto da equipe subordinada'),
('manage_sst', 'Saúde e Segurança', 'SST', 'Gerenciar atestados e eventos de SST'),
('view_reports', 'Visualizar Relatórios Gerais', 'Geral', 'Acesso aos relatórios gerenciais e exportações'),
('view_audit_logs', 'Visualização de Trilha de Auditoria', 'Auditoria', 'Consultar logs imutáveis de auditoria, eventos de documentos e hashes forenses H1/H2'),
('manage_legal_parameters', 'Gestão de Tabelas Legais e Rubricas', 'Configurações', 'Cadastrar e atualizar alíquotas de INSS, faixas de IRRF e rubricas da folha'),
('self_service_portal', 'Portal de Autoatendimento', 'Colaborador', 'Acesso às rotas do portal do colaborador: holerites próprios, ponto mobile REP-P e assinaturas')
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 3. Inserir e Sincronizar Perfis do Sistema (Roles)
INSERT INTO public.roles (id, tenant_id, name, description, is_system_role) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'Administrador Global', 'Acesso irrestrito a todos os módulos e configurações do sistema.', TRUE),
('00000000-0000-0000-0000-000000000002', NULL, 'Analista de DP', 'Acesso à folha de pagamento, contratos, benefícios, ponto e encargos.', TRUE),
('00000000-0000-0000-0000-000000000003', NULL, 'Especialista SST', 'Acesso exclusivo ao módulo de Saúde e Segurança do Trabalho.', TRUE),
('00000000-0000-0000-0000-000000000004', NULL, 'Gestor de Equipe', 'Acesso a espelho de ponto, banco de horas e aprovações da sua equipe.', TRUE),
('00000000-0000-0000-0000-000000000005', NULL, 'Contador / Fiscal', 'Acesso para conferência de resumo contábil, guias tributárias e CNAB.', TRUE),
('00000000-0000-0000-0000-000000000006', NULL, 'Auditor de Conformidade', 'Acesso somente-leitura à trilha de auditoria e hashes de documentos.', TRUE),
('00000000-0000-0000-0000-000000000007', NULL, 'Colaborador', 'Acesso exclusivo ao Portal do Colaborador (autoatendimento e ponto).', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

-- 4. Vincular Permissões Oficiais por Role (Princípio do Menor Privilégio)

-- 4.1 Administrador Global
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000001', 'manage_users'),
('00000000-0000-0000-0000-000000000001', 'manage_settings'),
('00000000-0000-0000-0000-000000000001', 'manage_employees'),
('00000000-0000-0000-0000-000000000001', 'view_team_employees'),
('00000000-0000-0000-0000-000000000001', 'manage_payroll'),
('00000000-0000-0000-0000-000000000001', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000001', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000001', 'manage_time_tracking'),
('00000000-0000-0000-0000-000000000001', 'manage_team_time_tracking'),
('00000000-0000-0000-0000-000000000001', 'manage_sst'),
('00000000-0000-0000-0000-000000000001', 'view_reports'),
('00000000-0000-0000-0000-000000000001', 'view_audit_logs'),
('00000000-0000-0000-0000-000000000001', 'manage_legal_parameters'),
('00000000-0000-0000-0000-000000000001', 'self_service_portal')
ON CONFLICT DO NOTHING;

-- 4.2 Analista de DP
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000002', 'manage_employees'),
('00000000-0000-0000-0000-000000000002', 'manage_payroll'),
('00000000-0000-0000-0000-000000000002', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000002', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000002', 'manage_time_tracking'),
('00000000-0000-0000-0000-000000000002', 'manage_sst'),
('00000000-0000-0000-0000-000000000002', 'view_reports'),
('00000000-0000-0000-0000-000000000002', 'manage_legal_parameters')
ON CONFLICT DO NOTHING;

-- 4.3 Especialista SST
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000003', 'manage_sst'),
('00000000-0000-0000-0000-000000000003', 'view_reports')
ON CONFLICT DO NOTHING;

-- 4.4 Gestor de Equipe
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000004', 'view_team_employees'),
('00000000-0000-0000-0000-000000000004', 'manage_team_time_tracking'),
('00000000-0000-0000-0000-000000000004', 'view_reports')
ON CONFLICT DO NOTHING;

-- 4.5 Contador / Fiscal
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000005', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000005', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000005', 'view_reports')
ON CONFLICT DO NOTHING;

-- 4.6 Auditor de Conformidade
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000006', 'view_audit_logs'),
('00000000-0000-0000-0000-000000000006', 'view_reports')
ON CONFLICT DO NOTHING;

-- 4.7 Colaborador
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000007', 'self_service_portal')
ON CONFLICT DO NOTHING;

-- 5. Sincronizar role_id para usuários existentes conforme papel textual
UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000001' 
WHERE role IN ('system_admin', 'tenant_admin') AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000001');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000002' 
WHERE role = 'dp_analyst' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000002');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000003' 
WHERE role = 'sst_specialist' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000003');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000004' 
WHERE role = 'manager' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000004');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000005' 
WHERE role = 'accountant' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000005');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000006' 
WHERE role = 'auditor' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000006');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000007' 
WHERE role = 'employee' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000007');

-- 6. Políticas de RLS Fortalecidas para Holerites e Contratos (Proteção de Dados Salariais)

-- Recriar política de SELECT em payslips com filtro estrito de menor privilégio
DROP POLICY IF EXISTS "View payslips" ON public.payslips;
CREATE POLICY "View payslips" ON public.payslips FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND (
            -- Usuários administrativos, contábeis e auditores do tenant
            EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid() 
                AND tu.tenant_id = payslips.tenant_id 
                AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor')
            )
            -- Ou o próprio colaborador visualizando exclusivamente seu holerite FECHADO
            OR EXISTS (
                SELECT 1 FROM public.tenant_users tu
                JOIN public.employment_contracts ec ON ec.worker_id = tu.worker_id
                WHERE tu.user_id = auth.uid()
                AND tu.tenant_id = payslips.tenant_id
                AND ec.id = payslips.contract_id 
                AND payslips.status = 'CLOSED'
            )
        )
    );

-- Recriar política de mutação (INSERT, UPDATE, DELETE) em payslips: estrita a Admin e DP
DROP POLICY IF EXISTS "Manage payslips" ON public.payslips;
CREATE POLICY "Manage payslips" ON public.payslips FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = payslips.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Recriar política de SELECT em payslip_items vinculada à visibilidade do payslip
DROP POLICY IF EXISTS "View payslip_items" ON public.payslip_items;
CREATE POLICY "View payslip_items" ON public.payslip_items FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.payslips p
            WHERE p.id = payslip_items.payslip_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    WHERE tu.user_id = auth.uid() 
                    AND tu.tenant_id = payslip_items.tenant_id 
                    AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor')
                )
                OR EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    JOIN public.employment_contracts ec ON ec.worker_id = tu.worker_id
                    WHERE tu.user_id = auth.uid()
                    AND tu.tenant_id = payslip_items.tenant_id
                    AND ec.id = p.contract_id 
                    AND p.status = 'CLOSED'
                )
            )
        )
    );

-- Recriar política de mutação em payslip_items
DROP POLICY IF EXISTS "Manage payslip_items" ON public.payslip_items;
CREATE POLICY "Manage payslip_items" ON public.payslip_items FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = payslip_items.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Recriar política de SELECT em employment_contracts com proteção de privacidade
DROP POLICY IF EXISTS "Users can view employment_contracts in their tenants" ON public.employment_contracts;
CREATE POLICY "Users can view employment_contracts in their tenants" 
    ON public.employment_contracts FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND (
            EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid() 
                AND tu.tenant_id = employment_contracts.tenant_id 
                AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor', 'manager')
            )
            OR EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
                AND tu.tenant_id = employment_contracts.tenant_id
                AND tu.worker_id = employment_contracts.worker_id
            )
        )
    );

-- Mutação de contratos: restrito a Admin e DP
DROP POLICY IF EXISTS "Tenant Admins and DP can manage employment_contracts" ON public.employment_contracts;
CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = employment_contracts.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Política de Leitura em audit.logs: apenas Admin e Auditor
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'audit' AND table_name = 'logs') THEN
        EXECUTE 'ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Auditors can read tenant logs" ON audit.logs';
        EXECUTE 'DROP POLICY IF EXISTS "Admins and Auditors can view audit logs" ON audit.logs';
        EXECUTE 'CREATE POLICY "Admins and Auditors can view audit logs" ON audit.logs FOR SELECT 
            USING (
                tenant_id = ANY(public.user_tenant_ids())
                AND EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    WHERE tu.user_id = auth.uid() 
                    AND tu.tenant_id = audit.logs.tenant_id 
                    AND tu.role IN (''system_admin'', ''tenant_admin'', ''auditor'')
                )
            )';
    END IF;
END $$;
