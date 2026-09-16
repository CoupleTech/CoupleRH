-- Migration: 00020_create_payroll_rubrics
-- Description: Tabela base para o Motor de Regras e Rubricas da Folha de Pagamento.

DROP TABLE IF EXISTS public.payroll_rubrics CASCADE;

CREATE TABLE public.payroll_rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Código numérico ou alfanumérico definido pela empresa (ex: 101, 150)
    name TEXT NOT NULL, -- Nome da rubrica (ex: Salário Base, Horas Extras 50%)
    
    -- Tipo principal da rubrica
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'BASE')), -- Provento, Desconto, Base de Cálculo
    
    -- Categoria para organizar e filtrar relatórios
    category TEXT NOT NULL CHECK (category IN ('SALARY', 'OVERTIME', 'ALLOWANCE', 'TAX', 'ADVANCE', 'OTHER')),
    
    -- Regras do Motor de Cálculo
    calculation_type TEXT NOT NULL CHECK (calculation_type IN ('FIXED', 'FORMULA', 'PERCENTAGE_OF_BASE', 'REFERENCE_TABLE')),
    formula TEXT, -- Regra inteligente em texto, ex: "(base_salary / workload) * 1.5 * reference"
    
    -- Incidências Tributárias (para eSocial e Base de Cálculo)
    incidence_inss BOOLEAN DEFAULT false,
    incidence_irrf BOOLEAN DEFAULT false,
    incidence_fgts BOOLEAN DEFAULT false,
    
    esocial_code TEXT, -- Código na Tabela 3 do eSocial
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, code) -- Impede dois eventos com o mesmo código na mesma empresa
);

-- Habilitar RLS
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view payroll rubrics" 
    ON public.payroll_rubrics FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage payroll rubrics" 
    ON public.payroll_rubrics FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = payroll_rubrics.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- Triggers de Auditoria
CREATE TRIGGER audit_payroll_rubrics_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Força atualização de cache
NOTIFY pgrst, 'reload schema';
