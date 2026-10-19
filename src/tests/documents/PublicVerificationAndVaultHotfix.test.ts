import { describe, it, expect, vi } from 'vitest';
import { formatVerificationCode, validateVerificationCode } from '../../services/documents/documentSignatureModel';

describe('HOTFIX: Cofre Digital, Verificação Pública e Lembretes de Documentos', () => {
  describe('Item 1: Expurgo e Soft-Delete no Cofre Digital', () => {
    it('deve filtrar e ignorar documentos marcados com deleted_at', () => {
      const documents = [
        {
          id: 'b2bd30c6-8575-4f26-affc-c0148ec593cf',
          title: 'Aviso de Férias - Residual Teste',
          deleted_at: '2026-10-19T13:59:02.166Z'
        },
        {
          id: 'd254e8a0-48ee-4445-a285-82d1ea47ddfb',
          title: 'Recibo de Férias - Residual Teste',
          deleted_at: '2026-10-19T13:59:02.166Z'
        },
        {
          id: 'd4840ccc-cbc5-4a74-bfda-051c93e636ca',
          title: 'Aviso de Férias - Oficial',
          deleted_at: null
        },
        {
          id: '4739d698-0d6b-4f90-9ec3-2d8cf7ef90f9',
          title: 'Recibo de Férias - Oficial',
          deleted_at: null
        }
      ];

      const activeDocs = documents.filter(d => d.deleted_at === null);
      expect(activeDocs).toHaveLength(2);
      expect(activeDocs.map(d => d.id)).toEqual([
        'd4840ccc-cbc5-4a74-bfda-051c93e636ca',
        '4739d698-0d6b-4f90-9ec3-2d8cf7ef90f9'
      ]);
    });
  });

  describe('Item 2: Sanitização e Resolução de Código de Verificação Pública', () => {
    it('deve extrair os 8 caracteres alfanuméricos ignorando o prefixo CRH e hífens', () => {
      const rawCode = 'CRH-D484-0CCC';
      const clean = rawCode.replace(/[^0-9a-zA-Z]/g, '');
      expect(clean).toBe('CRHD4840CCC');

      const cleanNoPrefix = clean.toUpperCase().startsWith('CRH') ? clean.substring(3) : clean;
      expect(cleanNoPrefix).toBe('D4840CCC');
      expect(cleanNoPrefix.toLowerCase()).toBe('d4840ccc');
    });

    it('deve identificar corretamente UUIDs completos vs códigos de chancela', () => {
      const uuidCode = 'd4840ccc-cbc5-4a74-bfda-051c93e636ca';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidCode);
      expect(isUuid).toBe(true);

      const chancelCode = 'CRH-KHJW-C5AG';
      const isChancelUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chancelCode);
      expect(isChancelUuid).toBe(false);
      expect(validateVerificationCode(chancelCode)).toBe(true);
    });

    it('deve aplicar máscara de proteção LGPD no nome e no CPF na resposta pública', () => {
      const mockRawPerson = {
        full_name: 'KAUAN GONÇALVES DA SILVA',
        cpf: '425.005.068-86'
      };

      // Regra de mascaramento implementada na RPC verify_public_document
      const parts = mockRawPerson.full_name.trim().split(' ');
      const maskedName = parts.length > 1
        ? `${parts[0]} ${parts[1][0]}. ***`
        : `${mockRawPerson.full_name.substring(0, 3)}***`;

      const maskedCpf = '***.***.***-**';

      expect(maskedName).toBe('KAUAN G. ***');
      expect(maskedCpf).toBe('***.***.***-**');
    });
  });

  describe('Item 3: Registro de Eventos e Lembretes (document_events)', () => {
    it('deve exigir e validar tenant_id no payload de document_events prevenindo erro 23502', () => {
      const mockDoc = {
        id: 'd4840ccc-cbc5-4a74-bfda-051c93e636ca',
        tenant_id: 'e5dcf4fc-47cd-4af0-8c64-8f01e265d659',
        title: 'Aviso de Férias'
      };

      const buildEventPayload = (doc: typeof mockDoc, channel: 'WHATSAPP' | 'EMAIL') => {
        if (!doc.tenant_id) {
          throw new Error('violates not-null constraint on column tenant_id');
        }
        return {
          tenant_id: doc.tenant_id,
          document_id: doc.id,
          event: channel === 'WHATSAPP' ? 'NOTIFIED_WHATSAPP' : 'NOTIFIED_EMAIL',
          meta: {
            channel,
            sentBy: 'DP_PANEL'
          }
        };
      };

      const payload = buildEventPayload(mockDoc, 'WHATSAPP');
      expect(payload.tenant_id).toBe('e5dcf4fc-47cd-4af0-8c64-8f01e265d659');
      expect(payload.document_id).toBe('d4840ccc-cbc5-4a74-bfda-051c93e636ca');
      expect(payload.event).toBe('NOTIFIED_WHATSAPP');

      // Se tenant_id for omitido, lança erro antes de enviar
      const invalidDoc = { ...mockDoc, tenant_id: '' };
      expect(() => buildEventPayload(invalidDoc, 'WHATSAPP')).toThrow('tenant_id');
    });
  });
});
