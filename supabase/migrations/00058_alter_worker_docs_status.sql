-- Migration: 00058_alter_worker_docs_status
-- Description: Altera a constraint de status em worker_personal_documents para suportar o fluxo de upload e auditoria

ALTER TABLE public.worker_personal_documents
DROP CONSTRAINT IF EXISTS worker_personal_documents_status_check;

ALTER TABLE public.worker_personal_documents
ADD CONSTRAINT worker_personal_documents_status_check 
CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']));
