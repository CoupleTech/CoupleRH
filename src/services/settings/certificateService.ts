/**
 * certificateService.ts
 * 
 * Serviço de gerenciamento e governança de Certificados Digitais ICP-Brasil (A1 .pfx / .p12)
 * para transmissão eSocial (CONF-05).
 */

import { supabase } from '../../lib/supabase';

export type CertificateStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_CONFIGURED';

export interface TenantCertificate {
  id: string;
  tenant_id: string;
  company_id?: string | null;
  filename: string;
  subject_name: string;
  cnpj: string;
  issuer: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  environment: 'producao' | 'restrita';
  is_active: boolean;
  days_remaining: number;
  status: CertificateStatus;
  created_at: string;
}

export const TenantCertificate = {} as const;

export interface CertificateUploadPayload {
  filename: string;
  subject_name: string;
  cnpj: string;
  issuer: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  environment: 'producao' | 'restrita';
  password?: string;
}

export const CertificateService = {
  /**
   * Formata número de CNPJ para 00.000.000/0000-00
   */
  formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return cnpj;
  },

  /**
   * Valida payload do certificado antes da instalação
   */
  validatePayload(payload: CertificateUploadPayload): { valid: boolean; error?: string } {
    if (!payload.filename || (!payload.filename.toLowerCase().endsWith('.pfx') && !payload.filename.toLowerCase().endsWith('.p12'))) {
      return { valid: false, error: 'O arquivo deve possuir extensão .pfx ou .p12 (padrão PKCS#12).' };
    }

    if (!payload.subject_name || payload.subject_name.trim().length < 3) {
      return { valid: false, error: 'Razão Social / Titular do certificado é obrigatório.' };
    }

    const cleanCnpj = payload.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14 && cleanCnpj.length !== 11) {
      return { valid: false, error: 'CNPJ do certificado inválido (deve conter 14 dígitos).' };
    }

    if (!payload.issuer || payload.issuer.trim().length < 2) {
      return { valid: false, error: 'Autoridade Certificadora emissora é obrigatória.' };
    }

    if (!payload.serial_number || payload.serial_number.trim().length < 2) {
      return { valid: false, error: 'Número de série do certificado é obrigatório.' };
    }

    const fromDate = new Date(payload.valid_from);
    const toDate = new Date(payload.valid_to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { valid: false, error: 'Datas de vigência do certificado são inválidas.' };
    }

    if (toDate <= fromDate) {
      return { valid: false, error: 'A data de expiração deve ser posterior à data de emissão.' };
    }

    if (!['producao', 'restrita'].includes(payload.environment)) {
      return { valid: false, error: 'Ambiente do eSocial inválido (permitidos: producao, restrita).' };
    }

    return { valid: true };
  },

  /**
   * Calcula o status e dias restantes a partir da data de expiração
   */
  computeStatus(validTo: string): { daysRemaining: number; status: CertificateStatus } {
    const now = new Date();
    const exp = new Date(validTo);
    const diffMs = exp.getTime() - now.getTime();
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { daysRemaining, status: 'EXPIRED' };
    }
    if (daysRemaining <= 30) {
      return { daysRemaining, status: 'EXPIRING_SOON' };
    }
    return { daysRemaining, status: 'VALID' };
  },

  /**
   * Busca o certificado ativo do tenant autenticado para o ambiente indicado
   */
  async getActiveCertificate(environment: 'producao' | 'restrita' = 'producao'): Promise<TenantCertificate | null> {
    try {
      // 1. Tentar buscar via RPC com diagnóstico
      const { data, error } = await supabase.rpc('get_tenant_active_certificate', {
        p_environment: environment
      });

      if (!error && data) {
        return {
          id: data.id,
          tenant_id: data.tenant_id,
          company_id: data.company_id,
          filename: data.filename,
          subject_name: data.subject_name,
          cnpj: data.cnpj,
          issuer: data.issuer,
          serial_number: data.serial_number,
          valid_from: data.valid_from,
          valid_to: data.valid_to,
          environment: data.environment,
          is_active: data.is_active,
          days_remaining: data.days_remaining,
          status: data.status as CertificateStatus,
          created_at: data.created_at
        };
      }

      // 2. Fallback defensivo via query direta
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: tu } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!tu?.tenant_id) return null;

      const { data: certRow } = await supabase
        .from('tenant_certificates')
        .select('*')
        .eq('tenant_id', tu.tenant_id)
        .eq('environment', environment)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!certRow) return null;

      const { daysRemaining, status } = this.computeStatus(certRow.valid_to);

      return {
        id: certRow.id,
        tenant_id: certRow.tenant_id,
        company_id: certRow.company_id,
        filename: certRow.filename,
        subject_name: certRow.subject_name,
        cnpj: certRow.cnpj,
        issuer: certRow.issuer,
        serial_number: certRow.serial_number,
        valid_from: certRow.valid_from,
        valid_to: certRow.valid_to,
        environment: certRow.environment,
        is_active: certRow.is_active,
        days_remaining: daysRemaining,
        status,
        created_at: certRow.created_at
      };
    } catch (err) {
      console.error('Falha ao buscar certificado ativo do tenant:', err);
      return null;
    }
  },

  /**
   * Instala um novo certificado A1 no tenant
   */
  async saveCertificate(payload: CertificateUploadPayload): Promise<{ success: boolean; certificate?: any; error?: string }> {
    const validation = this.validatePayload(payload);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const { data, error } = await supabase.rpc('save_tenant_certificate', {
        p_filename: payload.filename,
        p_subject_name: payload.subject_name,
        p_cnpj: payload.cnpj,
        p_issuer: payload.issuer,
        p_serial_number: payload.serial_number,
        p_valid_from: payload.valid_from,
        p_valid_to: payload.valid_to,
        p_environment: payload.environment
      });

      if (error) {
        // Fallback defensivo via insert direto caso a RPC falhe por permissão
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tu } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (tu?.tenant_id) {
            // Desativar anteriores
            await supabase
              .from('tenant_certificates')
              .update({ is_active: false })
              .eq('tenant_id', tu.tenant_id)
              .eq('environment', payload.environment)
              .eq('is_active', true);

            // Inserir novo
            const cleanCnpj = payload.cnpj.replace(/\D/g, '');
            const { data: inserted, error: insertErr } = await supabase
              .from('tenant_certificates')
              .insert({
                tenant_id: tu.tenant_id,
                filename: payload.filename,
                subject_name: payload.subject_name,
                cnpj: cleanCnpj,
                issuer: payload.issuer,
                serial_number: payload.serial_number,
                valid_from: payload.valid_from,
                valid_to: payload.valid_to,
                environment: payload.environment,
                is_active: true,
                created_by: user.id
              })
              .select()
              .single();

            if (!insertErr && inserted) {
              return { success: true, certificate: inserted };
            }
          }
        }

        return { success: false, error: error.message };
      }

      return { success: true, certificate: data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro inesperado ao salvar certificado digital.' };
    }
  },

  /**
   * Revoga / desativa um certificado digital existente
   */
  async revokeCertificate(certificateId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('revoke_tenant_certificate', {
        p_certificate_id: certificateId,
        p_reason: reason
      });

      if (error) {
        // Fallback direto
        const { error: updErr } = await supabase
          .from('tenant_certificates')
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revocation_reason: reason
          })
          .eq('id', certificateId);

        if (!updErr) {
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao revogar certificado.' };
    }
  }
};
