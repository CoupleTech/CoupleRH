import { describe, it, expect } from 'vitest';
import { DocumentComplianceService } from '../../services/documents/documentComplianceService';

describe('AS-07, AS-10 e AS-11: Compliance de Prazos, Notificações e Contestação', () => {
  it('deve validar prazo regular de aviso de férias com antecedência >= 30 dias (Art. 135 CLT)', () => {
    const result = DocumentComplianceService.checkVacationCompliance(
      '2026-11-01',
      '2026-10-01',
      '2026-10-30'
    );

    expect(result.isNoticeCompliant).toBe(true);
    expect(result.noticeAdvanceDays).toBe(31);
    expect(result.noticeWarning).toBeUndefined();
    expect(result.isPaymentCompliant).toBe(true);
  });

  it('deve alertar risco quando o aviso de férias for emitido com menos de 30 dias', () => {
    const result = DocumentComplianceService.checkVacationCompliance(
      '2026-11-01',
      '2026-10-15', // Apenas 17 dias
      '2026-10-30'
    );

    expect(result.isNoticeCompliant).toBe(false);
    expect(result.noticeAdvanceDays).toBe(17);
    expect(result.noticeWarning).toContain('Art. 135 CLT');
  });

  it('deve alertar risco grave quando o pagamento de férias for feito a menos de 2 dias do gozo (Art. 145 CLT)', () => {
    const result = DocumentComplianceService.checkVacationCompliance(
      '2026-11-01',
      '2026-10-01',
      '2026-11-01' // Pago no próprio dia de início (0 dias de antecedência)
    );

    expect(result.isPaymentCompliant).toBe(false);
    expect(result.paymentAdvanceDays).toBe(0);
    expect(result.paymentWarning).toContain('Art. 145 CLT');
    expect(result.paymentWarning).toContain('dobra de férias');
  });

  it('deve construir payload de contestação com validação de motivo mínimo (AS-11)', () => {
    expect(() => {
      DocumentComplianceService.buildContestPayload('doc-1', 'worker-1', 'curto');
    }).toThrow(/pelo menos 10 caracteres/);

    const valid = DocumentComplianceService.buildContestPayload(
      'doc-1',
      'worker-1',
      'O valor das horas extras está divergente da folha anterior.',
      'CONTESTED'
    );

    expect(valid.documentId).toBe('doc-1');
    expect(valid.decision).toBe('CONTESTED');
    expect(valid.reason).toContain('divergente');
    expect(valid.contestedAt).toBeDefined();
  });

  it('deve gerar mensagens de notificação para WhatsApp e E-mail com links e prazos (AS-07)', () => {
    const whatsapp = DocumentComplianceService.generateNotificationMessage(
      'WHATSAPP',
      'Ana Clara Souza',
      'Holerite 10/2026',
      'CRH-A1B2-C3D4',
      '2026-10-25'
    );

    expect(whatsapp.message).toContain('Ana');
    expect(whatsapp.message).toContain('Holerite 10/2026');
    expect(whatsapp.actionUrl).toContain('CRH-A1B2-C3D4');

    const email = DocumentComplianceService.generateNotificationMessage(
      'EMAIL',
      'Ana Clara Souza',
      'Espelho de Ponto',
      'CRH-A1B2-C3D4'
    );

    expect(email.title).toContain('Espelho de Ponto');
    expect(email.message).toContain('Portal do Colaborador');
  });
});
