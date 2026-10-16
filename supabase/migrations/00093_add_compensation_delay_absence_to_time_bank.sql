-- Migration: 00093_add_compensation_delay_absence_to_time_bank.sql
-- Tarefa TB-02: Adiciona COMPENSATION_DELAY e COMPENSATION_ABSENCE na constraint de time_bank_transactions

ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'COMPENSATION_DELAY',
        'COMPENSATION_ABSENCE',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

COMMENT ON CONSTRAINT time_bank_transactions_transaction_type_check ON public.time_bank_transactions IS 
'Tipos de transação de banco de horas suportados: OVERTIME, DELAY, ABSENCE, COMPENSATION_DAY_OFF, COMPENSATION_DELAY (abono de atraso com saldo), COMPENSATION_ABSENCE (abono de falta com saldo), MANUAL_ADJUSTMENT, PAYOUT e EXPIRATION_PAYOUT.';

NOTIFY pgrst, 'reload schema';
