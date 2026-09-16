-- Migration: 00045_add_company_to_benefits
-- Description: Adiciona company_id a benefit_catalogs para permitir benefícios específicos por filial.

ALTER TABLE public.benefit_catalogs 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Se company_id for null, o benefício é global para o tenant.
