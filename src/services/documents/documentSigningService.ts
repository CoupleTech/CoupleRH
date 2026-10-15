/**
 * documentSigningService.ts
 * 
 * Serviço de Assinatura Digital e Estampagem de Rubrica com Manifesto de Evidências
 * CoupleRH - Conformidade com MP 2.200-2/2001, Lei 14.063/2020 e LGPD
 * 
 * Tarefa: AS-04 e AS-05 (Fase P6)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  computeCanonicalHash,
  maskCpfForManifest,
  type SignatureStrokePoint,
  type SignatureAuthMethod,
  type GeolocationData,
  type ManifestMetadata
} from './documentSignatureModel';

export interface SignerInfo {
  name: string;
  cpf: string;
  role?: string;
  companyName: string;
  companyCnpj: string;
}

export interface AuditEvidence {
  ip: string;
  userAgent: string;
  signedAt: Date;
  authMethod: SignatureAuthMethod;
  geo?: GeolocationData | null;
}

export interface SignDocumentParams {
  originalPdfBytes: Uint8Array;
  expectedHashH1: string;
  signaturePngBase64: string;
  signatureStrokes?: SignatureStrokePoint[][] | null;
  signer: SignerInfo;
  audit: AuditEvidence;
  verificationCode: string;
  documentTitle?: string;
  appBaseUrl?: string;
}

export interface SignDocumentOutput {
  signedPdfBytes: Uint8Array;
  hashH1: string;
  hashH2: string;
  verificationCode: string;
  manifestData: ManifestMetadata;
}

export class DocumentSigningService {
  /**
   * Valida integridade H1, estampa rubrica no PDF original, anexa página de manifesto e calcula H2
   */
  public static async stampSignatureAndManifest(params: SignDocumentParams): Promise<SignDocumentOutput> {
    const {
      originalPdfBytes,
      expectedHashH1,
      signaturePngBase64,
      signer,
      audit,
      verificationCode,
      documentTitle = 'Documento Trabalhista',
      appBaseUrl = 'https://couplerh.com.br'
    } = params;

    // 1. Validação estrita do Hash H1
    const actualHashH1 = await computeCanonicalHash(originalPdfBytes);
    if (actualHashH1.toLowerCase() !== expectedHashH1.toLowerCase()) {
      throw new Error(`VIOLAÇÃO DE INTEGRIDADE: O hash do documento original (${actualHashH1}) não confere com o hash registrado (${expectedHashH1}). Documento pode ter sido adulterado.`);
    }

    // 2. Carrega o documento original com pdf-lib
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width: lastPageWidth } = lastPage.getSize();

    // 3. Embebe a imagem PNG da rubrica
    // Remove cabeçalho de data URL se presente
    const cleanBase64 = signaturePngBase64.replace(/^data:image\/\w+;base64,/, '');
    const signatureImageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

    const formattedIsoDate = audit.signedAt.toISOString();
    const formattedLocalDate = audit.signedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const maskedCpf = maskCpfForManifest(signer.cpf);
    const verificationUrl = `${appBaseUrl.replace(/\/$/, '')}/verificar/${verificationCode}`;

    // 4. Estampa miniatura e chancela na última página do documento original (rodapé)
    const stampWidth = 60;
    const stampHeight = 22;
    const stampX = lastPageWidth - stampWidth - 20;
    const stampY = 15;

    // Desenha miniatura da rubrica
    lastPage.drawImage(signatureImage, {
      x: stampX,
      y: stampY,
      width: stampWidth,
      height: stampHeight
    });

    // Texto da chancela legal no rodapé da última página
    lastPage.drawText(`Assinado digitalmente por: ${signer.name} (${maskedCpf})`, {
      x: 20,
      y: stampY + 12,
      size: 7,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.3)
    });
    lastPage.drawText(`Em ${formattedLocalDate} (UTC-03:00) · Cód: ${verificationCode}`, {
      x: 20,
      y: stampY + 4,
      size: 6.5,
      font: fontCourier,
      color: rgb(0.4, 0.45, 0.5)
    });

    // 5. Criação da PÁGINA DE MANIFESTO DE ASSINATURA ELETRÔNICA AVANÇADA
    const manifestoPage = pdfDoc.addPage([595.28, 841.89]); // A4 padrão
    const { width: mWidth, height: mHeight } = manifestoPage.getSize();

    // Faixa Superior / Cabeçalho do Manifesto
    manifestoPage.drawRectangle({
      x: 0,
      y: mHeight - 75,
      width: mWidth,
      height: 75,
      color: rgb(0.08, 0.15, 0.28) // Deep Navy
    });

    manifestoPage.drawText('MANIFESTO DE ASSINATURA ELETRÔNICA AVANÇADA', {
      x: 35,
      y: mHeight - 40,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    manifestoPage.drawText('Trilha Forense de Integridade e Evidências · Lei Federal nº 14.063/2020 e MP nº 2.200-2/2001', {
      x: 35,
      y: mHeight - 58,
      size: 8,
      font: fontRegular,
      color: rgb(0.75, 0.82, 0.95)
    });

    let currentY = mHeight - 105;

    // Seção 1: Identificação do Documento
    manifestoPage.drawRectangle({
      x: 35,
      y: currentY - 60,
      width: mWidth - 70,
      height: 60,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('1. DADOS DO DOCUMENTO', {
      x: 45,
      y: currentY - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    manifestoPage.drawText(`Título do Arquivo: ${documentTitle}`, {
      x: 45,
      y: currentY - 32,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });

    manifestoPage.drawText(`Código de Verificação: `, {
      x: 45,
      y: currentY - 46,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(verificationCode, {
      x: 145,
      y: currentY - 46,
      size: 9,
      font: fontCourier,
      color: rgb(0.15, 0.35, 0.8)
    });

    currentY -= 75;

    // Seção 2: Identificação do Signatário e Empregador
    manifestoPage.drawRectangle({
      x: 35,
      y: currentY - 75,
      width: mWidth - 70,
      height: 75,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('2. PARTES ENVOLVIDAS', {
      x: 45,
      y: currentY - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    manifestoPage.drawText(`Signatário (Colaborador): ${signer.name}`, {
      x: 45,
      y: currentY - 32,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(`CPF do Signatário: ${maskedCpf}  |  Função: ${signer.role || 'Colaborador CLT'}`, {
      x: 45,
      y: currentY - 45,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(`Empregador: ${signer.companyName}  |  CNPJ: ${signer.companyCnpj}`, {
      x: 45,
      y: currentY - 58,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });

    currentY -= 90;

    // Seção 3: Trilha de Evidências Forenses
    manifestoPage.drawRectangle({
      x: 35,
      y: currentY - 95,
      width: mWidth - 70,
      height: 95,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('3. EVIDÊNCIAS DIGITAIS DA ASSINATURA', {
      x: 45,
      y: currentY - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    manifestoPage.drawText(`Carimbo de Data e Hora: ${formattedLocalDate} (UTC-03:00) / ${formattedIsoDate}`, {
      x: 45,
      y: currentY - 32,
      size: 8,
      font: fontCourier,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(`Endereço IP Auditado: ${audit.ip}`, {
      x: 45,
      y: currentY - 45,
      size: 8,
      font: fontCourier,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(`Método de Autenticação: ${audit.authMethod}`, {
      x: 45,
      y: currentY - 58,
      size: 8,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3)
    });

    const uaText = audit.userAgent.length > 70 ? audit.userAgent.substring(0, 70) + '...' : audit.userAgent;
    manifestoPage.drawText(`Dispositivo / User-Agent: ${uaText}`, {
      x: 45,
      y: currentY - 71,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.45)
    });

    if (audit.geo) {
      manifestoPage.drawText(`Geolocalização (consentida): Lat ${audit.geo.latitude.toFixed(4)}, Lon ${audit.geo.longitude.toFixed(4)} (precisão ~${audit.geo.accuracyMeters}m)`, {
        x: 45,
        y: currentY - 84,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.45)
      });
    }

    currentY -= 110;

    // Seção 4: Rubrica Coletada
    manifestoPage.drawRectangle({
      x: 35,
      y: currentY - 85,
      width: mWidth - 70,
      height: 85,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('4. REPRESENTAÇÃO GRÁFICA DA RUBRICA COLETADA', {
      x: 45,
      y: currentY - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    // Desenha a imagem da rubrica em tamanho generoso na área
    manifestoPage.drawImage(signatureImage, {
      x: 50,
      y: currentY - 75,
      width: 140,
      height: 50
    });

    manifestoPage.drawText('Rubrica manuscrita capturada eletronicamente em tela touch / dispositivo apontador com traços vetoriais imutáveis.', {
      x: 210,
      y: currentY - 45,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5)
    });

    currentY -= 100;

    // Seção 5: Hashes Criptográficos e Validação Pública
    manifestoPage.drawRectangle({
      x: 35,
      y: currentY - 105,
      width: mWidth - 70,
      height: 105,
      color: rgb(0.95, 0.98, 0.95), // Light green tint
      borderColor: rgb(0.8, 0.88, 0.8),
      borderWidth: 1
    });

    manifestoPage.drawText('5. INTEGRIDADE CRIPTOGRÁFICA E CONFERÊNCIA PÚBLICA', {
      x: 45,
      y: currentY - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.08, 0.35, 0.15)
    });

    manifestoPage.drawText('Hash H1 (Documento Original do Servidor - SHA-256):', {
      x: 45,
      y: currentY - 32,
      size: 7.5,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.3)
    });
    manifestoPage.drawText(actualHashH1, {
      x: 45,
      y: currentY - 42,
      size: 7.5,
      font: fontCourier,
      color: rgb(0.2, 0.3, 0.4)
    });

    manifestoPage.drawText('URL Pública de Verificação:', {
      x: 45,
      y: currentY - 60,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.3)
    });
    manifestoPage.drawText(verificationUrl, {
      x: 45,
      y: currentY - 72,
      size: 8,
      font: fontCourier,
      color: rgb(0.15, 0.35, 0.8)
    });

    manifestoPage.drawText('Aponte a câmera ou consulte a URL acima para confirmar se os hashes conferem e atestar a veracidade.', {
      x: 45,
      y: currentY - 88,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4)
    });

    // Rodapé do Manifesto
    manifestoPage.drawText('Documento assinado eletronicamente com garantia de autoria e integridade segundo os padrões do CoupleRH.', {
      x: 35,
      y: 25,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6)
    });

    // 6. Salva o documento final
    const signedPdfBytes = await pdfDoc.save();

    // 7. Calcula o Hash H2 do PDF final
    const hashH2 = await computeCanonicalHash(signedPdfBytes);

    const manifestData: ManifestMetadata = {
      signerName: signer.name,
      maskedCpf,
      workerRole: signer.role,
      companyName: signer.companyName,
      companyCnpj: signer.companyCnpj,
      ipAddress: audit.ip,
      userAgent: audit.userAgent,
      signedAtIso: formattedIsoDate,
      authMethod: audit.authMethod,
      hashH1Original: actualHashH1,
      hashH2Signed: hashH2,
      verificationCode,
      verificationUrl,
      geoSummary: audit.geo ? `Lat ${audit.geo.latitude.toFixed(4)}, Lon ${audit.geo.longitude.toFixed(4)}` : undefined
    };

    return {
      signedPdfBytes,
      hashH1: actualHashH1,
      hashH2,
      verificationCode,
      manifestData
    };
  }

  /**
   * Verifica a integridade de um arquivo assinado comparando com o Hash H2 esperado
   */
  public static async verifySignedDocumentIntegrity(pdfBytes: Uint8Array, expectedHashH2: string): Promise<boolean> {
    const computedH2 = await computeCanonicalHash(pdfBytes);
    return computedH2.toLowerCase() === expectedHashH2.toLowerCase();
  }
}
