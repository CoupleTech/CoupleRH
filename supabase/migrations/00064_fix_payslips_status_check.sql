-- Migration: 00064_fix_payslips_status_check
-- Description: Drop the old constraint on payslips.status and create a new one matching payroll_periods statuses.

ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_status_check;

ALTER TABLE public.payslips ADD CONSTRAINT payslips_status_check 
CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));
