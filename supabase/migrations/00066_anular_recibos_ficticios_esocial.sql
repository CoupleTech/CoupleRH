-- Migration 00066_anular_recibos_ficticios_esocial.sql
-- FASE P0 / TAREFA T26: Anular registros com recibos fictícios no eSocial, preservando trilha de auditoria.

-- 1. Anular registros que receberam recibos fictícios gerados pela simulação (padrão '1.2.000%')
UPDATE public.esocial_transmissions
SET 
    status = 'DRAFT',
    error_message = COALESCE(error_message || ' | ', '') || 'Simulação anulada em produção (T26). Recibo fictício removido: ' || receipt_number,
    receipt_number = NULL,
    transmitted_at = NULL,
    updated_at = NOW()
WHERE receipt_number LIKE '1.2.000%';

-- 2. Atualizar documentação e comentários no catálogo do banco
COMMENT ON TABLE public.esocial_transmissions IS 'Tabela de transmissões eSocial. Registros com recibos fictícios gerados por simulação foram sanitizados e anulados pela migration 00066 (T26). Transmissão oficial prevista para Fase P10.';
