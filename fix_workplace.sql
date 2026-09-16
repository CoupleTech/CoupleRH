ALTER TABLE public.employment_contracts
ADD COLUMN workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL;
