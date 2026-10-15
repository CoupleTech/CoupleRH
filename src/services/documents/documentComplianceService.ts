/**
 * documentComplianceService.ts
 * 
 * Regras de Prazos Legais (CLT), Contestação, Notificações e Verificação Pública
 * CoupleRH - Conformidade com CLT Arts. 135, 145, 59 e Lei 14.063/2020
 * 
 * Tarefa: AS-07, AS-08, AS-10 e AS-11 (Fase P6)
 */

import type { DocumentType, DocumentSignatureStatus } from './documentSignatureModel';

export interface VacationComplianceCheck {
  isNoticeCompliant: boolean;
  noticeAdvanceDays: number;
  noticeWarning?: string;
  isPaymentCompliant: boolean;
  paymentAdvanceDays: number;
  paymentWarning?: string;
}

export interface DocumentVerificationPublicInfo {
  found: boolean;
  status?: DocumentSignatureStatus;
  title?: string;
  docType?: DocumentType;
  verificationCode?: string;
  signerName?: string;
  signerMaskedCpf?: string;
  companyName?: string;
  companyCnpj?: string;
  signedAt?: string;
  hashH1?: string;
  hashH2?: string;
  signedFileUrl?: string;
  isTampered?: boolean;
}

export class DocumentComplianceService {
  /**
   * Valida prazos legais de férias conforme a CLT (Arts. 135 e 145)
   * - Aviso de férias: antecedência mínima de 30 dias corridos antes do início do gozo (Art. 135 CLT)
   * - Pagamento de férias: realizado até 2 dias antes do início do gozo (Art. 145 CLT / Súmula 450 STF)
   */
  public static checkVacationCompliance(
    takeStartDateIso: string,
    noticeDateIso: string,
    paymentDateIso?: string
  ): VacationComplianceCheck {
    const takeStart = new Date(takeStartDateIso);
    const noticeDate = new Date(noticeDateIso);

    // Diferença em dias inteiros
    const msPerDay = 24 * 60 * 60 * 1000;
    const noticeAdvanceDays = Math.floor((takeStart.getTime() - noticeDate.getTime()) / msPerDay);

    const isNoticeCompliant = noticeAdvanceDays >= 30;
    const noticeWarning = isNoticeCompliant
      ? undefined
      : `ATENÇÃO TRABALHISTA (Art. 135 CLT): O aviso foi emitido com apenas ${noticeAdvanceDays} dias de antecedência. O prazo legal mínimo obrigatório é de 30 dias.`;

    let isPaymentCompliant = true;
    let paymentAdvanceDays = 0;
    let paymentWarning: string | undefined = undefined;

    if (paymentDateIso) {
      const paymentDate = new Date(paymentDateIso);
      paymentAdvanceDays = Math.floor((takeStart.getTime() - paymentDate.getTime()) / msPerDay);
      isPaymentCompliant = paymentAdvanceDays >= 2;
      if (!isPaymentCompliant) {
        paymentWarning = `RISCO TRABALHISTA GRAVE (Art. 145 CLT): O pagamento foi efetuado a menos de 2 dias do início do gozo das férias (antecedência: ${paymentAdvanceDays} dias). Sujeito à dobra de férias.`;
      }
    }

    return {
      isNoticeCompliant,
      noticeAdvanceDays,
      noticeWarning,
      isPaymentCompliant,
      paymentAdvanceDays,
      paymentWarning
    };
  }

  /**
   * Constrói o payload para contestação formal de documento trabalhista (AS-11)
   */
  public static buildContestPayload(
    documentId: string,
    workerId: string,
    reason: string,
    decision: 'CONTESTED' | 'REFUSED' = 'CONTESTED'
  ) {
    if (!reason || reason.trim().length < 10) {
      throw new Error('A justificativa da contestação é obrigatória e deve conter pelo menos 10 caracteres.');
    }

    return {
      documentId,
      workerId,
      decision,
      reason: reason.trim(),
      contestedAt: new Date().toISOString()
    };
  }

  /**
   * Gera texto padronizado para notificação (Portal/E-mail/WhatsApp) (AS-07)
   */
  public static generateNotificationMessage(
    channel: 'EMAIL' | 'WHATSAPP' | 'PORTAL',
    workerName: string,
    documentTitle: string,
    verificationCode: string,
    dueAt?: string
  ): { title: string; message: string; actionUrl: string } {
    const actionUrl = `https://couplerh.com.br/portal/documentos?doc=${verificationCode}`;
    const formattedDue = dueAt ? new Date(dueAt).toLocaleDateString('pt-BR') : 'o quanto antes';

    if (channel === 'WHATSAPP') {
      return {
        title: 'Documento Pendente para Assinatura',
        message: `Olá, ${workerName.split(' ')[0]}! Um novo documento foi disponibilizado no CoupleRH para sua assinatura eletrônica: *${documentTitle}*.\nPrazo para assinatura: ${formattedDue}.\nAcesse pelo link: ${actionUrl}`,
        actionUrl
      };
    }

    if (channel === 'EMAIL') {
      return {
        title: `CoupleRH: Documento pendente de assinatura (${documentTitle})`,
        message: `Olá, ${workerName}.\n\nInformamos que o documento "${documentTitle}" está disponível para sua ciência e assinatura digital avançada no Portal do Colaborador.\n\nCódigo do Documento: ${verificationCode}\nPrazo Legal: ${formattedDue}\n\nPor favor, acesse o portal para realizar a assinatura eletrônica com rubrica em tela: ${actionUrl}`,
        actionUrl
      };
    }

    return {
      title: 'Novo documento disponível',
      message: `Você possui o documento "${documentTitle}" aguardando sua assinatura eletrônica.`,
      actionUrl
    };
  }
}
