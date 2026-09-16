-- Adição de campos de endereço na tabela people
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Brasil',
ADD COLUMN IF NOT EXISTS reference_point TEXT,
ADD COLUMN IF NOT EXISTS residence_type TEXT;

-- Adição de campo para Vale Transporte/Passagens na tabela employment_contracts
-- Considerando que a especificação pede "quantidade de passagens"
ALTER TABLE public.employment_contracts
ADD COLUMN IF NOT EXISTS opts_for_transportation_voucher BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS transportation_tickets_per_day INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vt_operator TEXT,
ADD COLUMN IF NOT EXISTS vt_card_number TEXT,
ADD COLUMN IF NOT EXISTS vt_tariff_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS vt_discount_percentage NUMERIC(5,2) DEFAULT 6.00;
