import { supabase } from '../../lib/supabase';
import {
  DocumentGeneratorService,
  type TimeBankAgreementSnapshot,
  type GeneratedDocumentResult
} from './documentGeneratorService';

export interface AgreementValidity {
  validFrom: string;
  validTo: string;
  durationMonths: number;
}

export interface EmitTimeBankAgreementParams {
  tenantId: string;
  companyId: string;
  workerId: string;
  contractId?: string;
  validFrom?: string;
  validTo?: string;
  policyType?: 'INDIVIDUAL_AGREEMENT' | 'COLLECTIVE_AGREEMENT';
}

export interface EmitTimeBankAgreementResult {
  success: boolean;
  documentId?: string;
  verificationCode?: string;
  hashH1?: string;
  fileUrl?: string;
  whatsAppMessage?: string;
  error?: string;
}

export interface BatchEmitAgreementResult {
  totalRequested: number;
  emittedCount: number;
  skippedCount: number;
  errors: Array<{ workerId: string; error: string }>;
  results: Array<{ workerId: string; documentId: string; verificationCode: string }>;
}

export class TimeBankAgreementService {
  /**
   * Calcula a vigência padrão de 6 meses para o acordo individual (CLT Art. 59 § 5º)
   */
  public static calculateDefaultValidity(fromStr?: string): AgreementValidity {
    const fromDate = fromStr ? new Date(`${fromStr}T00:00:00`) : new Date();
    const toDate = new Date(fromDate);
    toDate.setMonth(toDate.getMonth() + 6);

    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    return {
      validFrom: formatYMD(fromDate),
      validTo: formatYMD(toDate),
      durationMonths: 6
    };
  }

  /**
   * Valida conformidade da vigência estipulada com a legislação trabalhista
   * (Individual: máx 6 meses / Coletivo: máx 12 meses)
   */
  public static validateAgreementPeriod(params: {
    validFrom: string;
    validTo: string;
    policyType?: 'INDIVIDUAL_AGREEMENT' | 'COLLECTIVE_AGREEMENT';
  }): { isValid: boolean; error?: string } {
    const from = new Date(`${params.validFrom}T00:00:00`);
    const to = new Date(`${params.validTo}T00:00:00`);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return { isValid: false, error: 'Datas de vigência inválidas' };
    }

    if (to <= from) {
      return { isValid: false, error: 'A data final deve ser posterior à data inicial' };
    }

    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const isCollective = params.policyType === 'COLLECTIVE_AGREEMENT';

    // 6 meses civis ~ 185 dias máx com margem de segurança de tolerância de 5 dias
    if (!isCollective && diffDays > 190) {
      return {
        isValid: false,
        error: 'Pela CLT (Art. 59 § 5º), o Acordo Individual de Banco de Horas tem limite improrrogável de 6 meses para compensação. Para prazos de até 1 ano, utilize Acordo Coletivo de Trabalho (CCT/ACT).'
      };
    }

    // 12 meses civis ~ 370 dias máx
    if (isCollective && diffDays > 375) {
      return {
        isValid: false,
        error: 'Pela CLT (Art. 59 § 2º), mesmo em Acordo Coletivo o prazo máximo de compensação é de 1 ano.'
      };
    }

    return { isValid: true };
  }

  /**
   * Constrói o payload para gravação na tabela employee_documents
   */
  public static buildDocumentPayload(params: {
    tenantId: string;
    companyId: string;
    workerId: string;
    snapshot: TimeBankAgreementSnapshot;
    fileUrl: string;
    hashH1: string;
    verificationCode: string;
  }) {
    const { tenantId, companyId, workerId, snapshot, fileUrl, hashH1, verificationCode } = params;

    return {
      tenant_id: tenantId,
      company_id: companyId,
      worker_id: workerId,
      title: 'Acordo Individual de Banco de Horas (CLT Art. 59 § 5º)',
      doc_type: 'TIME_BANK_AGREEMENT',
      document_type: 'TIME_BANK_AGREEMENT',
      status: 'PENDING',
      file_url: fileUrl,
      document_hash: hashH1,
      hash_original: hashH1,
      verification_code: verificationCode,
      requires_employee_signature: true,
      requires_otp: true,
      signature_level: 'ADVANCED',
      source_ref: `time_bank_agreement:${snapshot.agreementId}`,
      due_at: new Date(Date.now() + 15 * 86400000).toISOString(),
      metadata: {
        ...snapshot,
        verification_code: verificationCode,
        hash_original: hashH1
      }
    };
  }

  /**
   * Constrói mensagem amigável de notificação para WhatsApp / Mobile
   */
  public static buildWhatsAppNotificationMessage(params: {
    workerName: string;
    companyName: string;
    verificationCode: string;
    portalUrl: string;
    validTo: string;
  }): string {
    const { workerName, companyName, verificationCode, portalUrl, validTo } = params;
    return (
      `Olá, *${workerName}*! 👋\n\n` +
      `Sua empresa *${companyName}* disponibilizou o seu *Termo de Acordo Individual de Banco de Horas* (Art. 59, § 5º da CLT) para assinatura digital eletrônica.\n\n` +
      `📅 *Vigência do Acordo:* até ${validTo}\n` +
      `🔐 *Código de Autenticação:* \`${verificationCode}\`\n\n` +
      `Por favor, acesse o Portal do Colaborador no seu celular para ler e assinar com sua rubrica e código de segurança:\n` +
      `👉 ${portalUrl}\n\n` +
      `_Esta notificação foi gerada automaticamente pelo coupleRH._`
    );
  }

  /**
   * Emite e registra o Termo de Acordo Individual de Banco de Horas no Supabase
   */
  public static async emitTimeBankAgreement(
    params: EmitTimeBankAgreementParams
  ): Promise<EmitTimeBankAgreementResult> {
    const { tenantId, companyId, workerId, validFrom, validTo, policyType = 'INDIVIDUAL_AGREEMENT' } = params;

    try {
      // 1. Validar período
      const validity = validFrom && validTo
        ? { validFrom, validTo, durationMonths: 6 }
        : this.calculateDefaultValidity(validFrom);

      const periodValidation = this.validateAgreementPeriod({
        validFrom: validity.validFrom,
        validTo: validity.validTo,
        policyType
      });

      if (!periodValidation.isValid) {
        return { success: false, error: periodValidation.error };
      }

      // 2. Buscar dados da empresa
      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .select('corporate_name, trade_name, cnpj, city, state')
        .eq('id', companyId)
        .single();

      if (companyErr || !company) {
        return { success: false, error: 'Empresa não encontrada para emissão do termo' };
      }

      // 3. Buscar dados do colaborador
      const { data: worker, error: workerErr } = await supabase
        .from('workers')
        .select(`
          id,
          position_title,
          people (
            full_name,
            cpf,
            phone,
            email
          )
        `)
        .eq('id', workerId)
        .single();

      if (workerErr || !worker) {
        return { success: false, error: 'Colaborador não encontrado para emissão do termo' };
      }

      const person = (worker as any).people || {};
      const companyName = company.corporate_name || company.trade_name || 'EMPRESA';
      const companyCnpj = company.cnpj || '00.000.000/0001-00';
      const companyCityState = `${company.city || ''}/${company.state || ''}`.replace(/^\/|\/$/g, '') || 'Brasil';

      // 4. Montar snapshot
      const agreementId = crypto.randomUUID();
      const snapshot: TimeBankAgreementSnapshot = {
        agreementId,
        company: {
          corporateName: companyName,
          cnpj: companyCnpj,
          address: companyCityState
        },
        worker: {
          id: worker.id,
          fullName: person.full_name || 'Colaborador',
          cpf: person.cpf || '',
          positionTitle: worker.position_title || 'Colaborador'
        },
        validFrom: validity.validFrom,
        validTo: validity.validTo,
        agreementDate: new Date().toLocaleDateString('pt-BR'),
        termsVersion: '1.0'
      };

      // 5. Gerar PDF oficial
      const docResult: GeneratedDocumentResult = await DocumentGeneratorService.generateTimeBankAgreementPdf(snapshot);

      // 6. Upload do PDF no Storage Privado (com tolerância defensiva)
      let fileUrl = `agreements/${tenantId}/${workerId}/${agreementId}.pdf`;
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('private-documents')
          .upload(fileUrl, docResult.pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!uploadErr && uploadData?.path) {
          const { data: publicUrlData } = supabase.storage
            .from('private-documents')
            .getPublicUrl(uploadData.path);
          if (publicUrlData?.publicUrl) {
            fileUrl = publicUrlData.publicUrl;
          }
        }
      } catch (uploadException) {
        console.warn('Storage upload fallback:', uploadException);
      }

      // 7. Gravar em employee_documents
      const payload = this.buildDocumentPayload({
        tenantId,
        companyId,
        workerId,
        snapshot,
        fileUrl,
        hashH1: docResult.hashH1,
        verificationCode: docResult.verificationCode
      });

      const { data: docRecord, error: insertDocErr } = await supabase
        .from('employee_documents')
        .insert(payload)
        .select('id')
        .single();

      if (insertDocErr || !docRecord?.id) {
        console.error('Erro ao inserir em employee_documents:', insertDocErr);
        return { success: false, error: 'Falha ao gravar registro em employee_documents: ' + (insertDocErr?.message || '') };
      }

      // 8. Gravar trilha forense em document_events (se tabela existir)
      try {
        await supabase.from('document_events').insert({
          tenant_id: tenantId,
          document_id: docRecord.id,
          action: 'CREATED',
          actor_role: 'DP_ANALYST',
          details: {
            agreementId,
            docType: 'TIME_BANK_AGREEMENT',
            validFrom: validity.validFrom,
            validTo: validity.validTo,
            hashH1: docResult.hashH1,
            verificationCode: docResult.verificationCode
          }
        });
      } catch (evtErr) {
        console.warn('Registro de evento document_events ignorado:', evtErr);
      }

      // 9. Montar mensagem de WhatsApp
      const portalUrl = `${window.location.origin}/portal/login`;
      const whatsAppMessage = this.buildWhatsAppNotificationMessage({
        workerName: person.full_name || 'Colaborador',
        companyName,
        verificationCode: docResult.verificationCode,
        portalUrl,
        validTo: validity.validTo.split('-').reverse().join('/')
      });

      return {
        success: true,
        documentId: docRecord.id,
        verificationCode: docResult.verificationCode,
        hashH1: docResult.hashH1,
        fileUrl,
        whatsAppMessage
      };
    } catch (err: any) {
      console.error('Erro na emissão do acordo de banco de horas:', err);
      return { success: false, error: err.message || 'Erro inesperado na geração do acordo' };
    }
  }

  /**
   * Emissão em lote de acordos individuais para uma lista de colaboradores
   */
  public static async emitAgreementsBatch(params: {
    tenantId: string;
    companyId: string;
    workerIds: string[];
    validFrom?: string;
    validTo?: string;
  }): Promise<BatchEmitAgreementResult> {
    const { tenantId, companyId, workerIds, validFrom, validTo } = params;
    const results: Array<{ workerId: string; documentId: string; verificationCode: string }> = [];
    const errors: Array<{ workerId: string; error: string }> = [];

    for (const workerId of workerIds) {
      const res = await this.emitTimeBankAgreement({
        tenantId,
        companyId,
        workerId,
        validFrom,
        validTo
      });

      if (res.success && res.documentId && res.verificationCode) {
        results.push({
          workerId,
          documentId: res.documentId,
          verificationCode: res.verificationCode
        });
      } else {
        errors.push({
          workerId,
          error: res.error || 'Falha na emissão'
        });
      }
    }

    return {
      totalRequested: workerIds.length,
      emittedCount: results.length,
      skippedCount: errors.length,
      errors,
      results
    };
  }

  /**
   * Consulta os acordos de banco de horas já emitidos no tenant
   */
  public static async fetchIssuedAgreements(params: {
    tenantId: string;
    companyId?: string;
    workerId?: string;
  }) {
    const { tenantId, companyId, workerId } = params;

    let query = supabase
      .from('employee_documents')
      .select(`
        id,
        tenant_id,
        company_id,
        worker_id,
        title,
        doc_type,
        status,
        file_url,
        document_hash,
        hash_original,
        hash_signed,
        verification_code,
        signed_at,
        created_at,
        due_at,
        metadata,
        workers (
          id,
          position_title,
          people (
            full_name,
            cpf,
            phone,
            email
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('doc_type', 'TIME_BANK_AGREEMENT')
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (workerId) {
      query = query.eq('worker_id', workerId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar acordos emitidos:', error);
      return [];
    }

    return (data || []).map((doc: any) => ({
      id: doc.id,
      workerId: doc.worker_id,
      workerName: doc.workers?.people?.full_name || 'Colaborador',
      workerCpf: doc.workers?.people?.cpf || '',
      positionTitle: doc.workers?.position_title || 'Cargo',
      workerPhone: doc.workers?.people?.phone || '',
      status: doc.status as 'PENDING' | 'SIGNED' | 'REJECTED' | 'CONTESTED',
      verificationCode: doc.verification_code || doc.metadata?.verification_code,
      validFrom: doc.metadata?.validFrom,
      validTo: doc.metadata?.validTo,
      fileUrl: doc.file_url,
      createdAt: doc.created_at,
      signedAt: doc.signed_at
    }));
  }
}
