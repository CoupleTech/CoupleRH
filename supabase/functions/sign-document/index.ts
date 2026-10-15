import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.9";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskCpf(cpf: string): string {
  if (!cpf) return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return '***.***.***-**';
  return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação obrigatório." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      document_id,
      worker_id,
      signature_png_base64,
      signature_strokes,
      auth_method = 'SESSION_OTP',
      geo
    } = body;

    if (!document_id || !worker_id || !signature_png_base64) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes: document_id, worker_id e signature_png_base64 são requeridos." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor Supabase incompleta." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca o documento e valida status
    const { data: doc, error: docError } = await supabase
      .from('employee_documents')
      .select('*, workers(id, person_id, company_id, people(full_name, cpf, email), companies(corporate_name, trade_name, cnpj))')
      .eq('id', document_id)
      .eq('worker_id', worker_id)
      .is('deleted_at', null)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: "Documento não encontrado ou não pertence a este colaborador." }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (doc.status === 'SIGNED') {
      return new Response(
        JSON.stringify({ error: "Este documento já foi assinado e encontra-se congelado." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (doc.status !== 'PENDING_SIGNATURE' && doc.status !== 'PARTIALLY_SIGNED') {
      return new Response(
        JSON.stringify({ error: `O documento não está disponível para assinatura (Status atual: ${doc.status}).` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Obter o PDF original (do Storage ou regenerado se arquivo estiver salvo)
    let originalPdfBytes: Uint8Array | null = null;
    const originalPath = doc.file_url;

    if (originalPath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('private-documents')
        .download(originalPath);

      if (!downloadError && fileData) {
        originalPdfBytes = new Uint8Array(await fileData.arrayBuffer());
      }
    }

    // Se não encontrou no storage privado, tenta gerar uma folha inicial padronizada para o documento
    if (!originalPdfBytes) {
      const newPdf = await PDFDocument.create();
      const p = newPdf.addPage([595.28, 841.89]);
      const helv = await newPdf.embedFont(StandardFonts.HelveticaBold);
      const helvNorm = await newPdf.embedFont(StandardFonts.Helvetica);
      p.drawText(doc.title || 'Documento Trabalhista', { x: 50, y: 780, size: 16, font: helv });
      p.drawText(`Colaborador: ${doc.workers?.people?.full_name || 'N/A'}`, { x: 50, y: 740, size: 10, font: helvNorm });
      p.drawText(`Identificador: ${doc.verification_code || doc.id}`, { x: 50, y: 720, size: 9, font: helvNorm });
      originalPdfBytes = await newPdf.save();
    }

    // 3. Validação do Hash H1
    const actualH1 = await computeSha256(originalPdfBytes);
    const expectedH1 = doc.hash_original || actualH1;

    if (doc.hash_original && doc.hash_original.toLowerCase() !== actualH1.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Violação de integridade documental: o conteúdo não confere com o hash original registrado (H1)." }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Carrega com pdf-lib e anexa manifesto + rubrica
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const cleanBase64 = signature_png_base64.replace(/^data:image\/\w+;base64,/, '');
    const sigImageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

    const serverNow = new Date();
    const serverNowIso = serverNow.toISOString();
    const formattedDate = serverNow.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const maskedSignerCpf = maskCpf(doc.workers?.people?.cpf);
    const verificationCode = doc.verification_code || `CRH-${doc.id.substring(0, 8).toUpperCase()}`;

    // Estampa chancela na última página original
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width: lpW } = lastPage.getSize();
    lastPage.drawImage(sigImage, { x: lpW - 75, y: 15, width: 60, height: 22 });
    lastPage.drawText(`Assinado digitalmente por: ${doc.workers?.people?.full_name || 'Colaborador'} (${maskedSignerCpf})`, {
      x: 20,
      y: 26,
      size: 7,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.3)
    });
    lastPage.drawText(`Em ${formattedDate} (UTC-03:00) · Cód: ${verificationCode}`, {
      x: 20,
      y: 17,
      size: 6.5,
      font: fontCourier,
      color: rgb(0.4, 0.45, 0.5)
    });

    // Anexa Página de Manifesto
    const manifestoPage = pdfDoc.addPage([595.28, 841.89]);
    const { width: mW, height: mH } = manifestoPage.getSize();

    manifestoPage.drawRectangle({
      x: 0,
      y: mH - 75,
      width: mW,
      height: 75,
      color: rgb(0.08, 0.15, 0.28)
    });

    manifestoPage.drawText('MANIFESTO DE ASSINATURA ELETRÔNICA AVANÇADA', {
      x: 35,
      y: mH - 40,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    manifestoPage.drawText('Trilha Forense de Integridade e Evidências · Lei Federal nº 14.063/2020 e MP nº 2.200-2/2001', {
      x: 35,
      y: mH - 58,
      size: 8,
      font: fontNorm,
      color: rgb(0.75, 0.82, 0.95)
    });

    // Evidências
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const clientUa = req.headers.get('user-agent') || 'CoupleRH Web Client';

    manifestoPage.drawRectangle({
      x: 35,
      y: mH - 240,
      width: mW - 70,
      height: 145,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('DADOS DO SIGNATÁRIO E EVIDÊNCIAS DE AUTENTICAÇÃO', {
      x: 45,
      y: mH - 115,
      size: 9.5,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    manifestoPage.drawText(`Colaborador: ${doc.workers?.people?.full_name}  |  CPF: ${maskedSignerCpf}`, {
      x: 45,
      y: mH - 132,
      size: 8.5,
      font: fontNorm
    });
    manifestoPage.drawText(`Empresa: ${doc.workers?.companies?.corporate_name}  |  CNPJ: ${doc.workers?.companies?.cnpj}`, {
      x: 45,
      y: mH - 147,
      size: 8.5,
      font: fontNorm
    });
    manifestoPage.drawText(`Carimbo de Tempo: ${formattedDate} (UTC-03:00) / ${serverNowIso}`, {
      x: 45,
      y: mH - 162,
      size: 8,
      font: fontCourier
    });
    manifestoPage.drawText(`Endereço IP Auditado: ${clientIp}  |  Método: ${auth_method}`, {
      x: 45,
      y: mH - 177,
      size: 8,
      font: fontCourier
    });
    manifestoPage.drawText(`Dispositivo: ${clientUa.substring(0, 80)}`, {
      x: 45,
      y: mH - 192,
      size: 7.5,
      font: fontNorm
    });

    // Rubrica no Manifesto
    manifestoPage.drawRectangle({
      x: 35,
      y: mH - 340,
      width: mW - 70,
      height: 90,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1
    });

    manifestoPage.drawText('RUBRICA COLETADA', {
      x: 45,
      y: mH - 260,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35)
    });

    manifestoPage.drawImage(sigImage, {
      x: 50,
      y: mH - 330,
      width: 140,
      height: 50
    });

    // Salva o PDF final e calcula H2
    const signedPdfBytes = await pdfDoc.save();
    const hashH2 = await computeSha256(signedPdfBytes);

    // Hashes no Manifesto
    manifestoPage.drawRectangle({
      x: 35,
      y: mH - 450,
      width: mW - 70,
      height: 100,
      color: rgb(0.95, 0.98, 0.95),
      borderColor: rgb(0.8, 0.88, 0.8),
      borderWidth: 1
    });

    manifestoPage.drawText('INTEGRIDADE CRIPTOGRÁFICA (SHA-256)', {
      x: 45,
      y: mH - 365,
      size: 9,
      font: fontBold,
      color: rgb(0.08, 0.35, 0.15)
    });

    manifestoPage.drawText(`Hash H1 (Original): ${actualH1}`, {
      x: 45,
      y: mH - 380,
      size: 7.5,
      font: fontCourier
    });
    manifestoPage.drawText(`Hash H2 (Assinado): ${hashH2}`, {
      x: 45,
      y: mH - 395,
      size: 7.5,
      font: fontCourier
    });
    manifestoPage.drawText(`Código de Verificação: ${verificationCode}`, {
      x: 45,
      y: mH - 415,
      size: 8.5,
      font: fontBold
    });
    manifestoPage.drawText(`Verifique em: https://couplerh.com.br/verificar/${verificationCode}`, {
      x: 45,
      y: mH - 430,
      size: 8,
      font: fontCourier,
      color: rgb(0.15, 0.35, 0.8)
    });

    // Re-salva após preencher os textos finais
    const finalSignedPdfBytes = await pdfDoc.save();
    const finalHashH2 = await computeSha256(finalSignedPdfBytes);

    // 5. Salva arquivo no Storage Privado
    const signedStoragePath = `${doc.tenant_id}/${worker_id}/${document_id}_signed_${Date.now()}.pdf`;
    const rubricaStoragePath = `${doc.tenant_id}/${worker_id}/${document_id}_rubrica_${Date.now()}.png`;

    await supabase.storage
      .from('private-documents')
      .upload(signedStoragePath, finalSignedPdfBytes, { contentType: 'application/pdf', upsert: true });

    await supabase.storage
      .from('private-documents')
      .upload(rubricaStoragePath, sigImageBytes, { contentType: 'image/png', upsert: true });

    // 6. Atualiza employee_documents
    await supabase
      .from('employee_documents')
      .update({
        status: 'SIGNED',
        hash_original: actualH1,
        hash_signed: finalHashH2,
        signed_file_url: signedStoragePath,
        signed_at: serverNowIso,
        verification_code: verificationCode,
        updated_at: serverNowIso
      })
      .eq('id', document_id);

    // 7. Grava signatures_log imutável
    const manifestMetadata = {
      signerName: doc.workers?.people?.full_name,
      maskedCpf: maskedSignerCpf,
      companyName: doc.workers?.companies?.corporate_name,
      companyCnpj: doc.workers?.companies?.cnpj,
      ipAddress: clientIp,
      userAgent: clientUa,
      signedAtIso: serverNowIso,
      authMethod: auth_method,
      hashH1Original: actualH1,
      hashH2Signed: finalHashH2,
      verificationCode
    };

    await supabase
      .from('signatures_log')
      .insert({
        tenant_id: doc.tenant_id,
        employee_document_id: document_id,
        signer_user_id: worker_id,
        signer_role: 'EMPLOYEE',
        ip_address: clientIp,
        user_agent: clientUa,
        signature_timestamp: serverNowIso,
        document_hash_at_signing: actualH1,
        auth_method,
        geo: geo || null,
        signature_png_url: rubricaStoragePath,
        signature_strokes: signature_strokes || null,
        decision: 'SIGNED',
        manifest_metadata: manifestMetadata
      });

    // 8. Grava evento em document_events
    await supabase
      .from('document_events')
      .insert({
        tenant_id: doc.tenant_id,
        document_id: document_id,
        event: 'SIGNED',
        at: serverNowIso,
        ip: clientIp,
        user_agent: clientUa,
        actor_user_id: worker_id,
        meta: {
          hashH1: actualH1,
          hashH2: finalHashH2,
          verificationCode,
          authMethod: auth_method
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        verification_code: verificationCode,
        hash_original: actualH1,
        hash_signed: finalHashH2,
        signed_at: serverNowIso,
        signed_file_url: signedStoragePath
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno ao assinar documento." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
