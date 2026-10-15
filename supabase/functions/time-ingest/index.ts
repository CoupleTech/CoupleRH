import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-signature, x-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function generateHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cleanDigits(val?: string | null): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const deviceId = req.headers.get('x-device-id');
    const signature = req.headers.get('x-signature');
    const timestampStr = req.headers.get('x-timestamp');

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "Header 'x-device-id' obrigatório." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição deve ser um JSON válido." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta (chaves ausentes)." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar informações do dispositivo no banco
    const { data: device, error: deviceError } = await supabase
      .from('time_devices')
      .select('id, tenant_id, company_id, status, last_nsr, api_key_hash')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: "Dispositivo não encontrado." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (device.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: `Dispositivo inativo ou em manutenção. Status: ${device.status}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validação de autenticação HMAC
    if (device.api_key_hash) {
      if (!signature || !timestampStr) {
        return new Response(
          JSON.stringify({ error: "Headers 'x-signature' e 'x-timestamp' são obrigatórios para este dispositivo." }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      const toleranceMs = 10 * 60 * 1000; // 10 minutos
      if (isNaN(timestamp) || Math.abs(now - timestamp) > toleranceMs) {
        return new Response(
          JSON.stringify({ error: "Timestamp fora da janela de tolerância de 10 minutos (proteção contra repetição)." }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expectedSignature = await generateHmacSha256(`${timestampStr}:${rawBody}`, device.api_key_hash);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "Assinatura HMAC inválida." }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Processar registros do lote
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return new Response(
        JSON.stringify({ message: "Lote vazio recebido.", count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buscar trabalhadores do tenant para vincular CPF/PIS
    const { data: contracts } = await supabase
      .from('employment_contracts')
      .select('id, worker_id, workers(id, person_id, people(cpf, pis))')
      .eq('tenant_id', device.tenant_id)
      .eq('status', 'ACTIVE');

    const workerByCpf = new Map<string, { worker_id: string; contract_id: string; cpf: string; pis?: string }>();
    const workerByPis = new Map<string, { worker_id: string; contract_id: string; cpf: string; pis?: string }>();

    if (contracts) {
      for (const c of contracts) {
        const p = (c.workers as any)?.people;
        const cpfClean = cleanDigits(p?.cpf);
        const pisClean = cleanDigits(p?.pis);
        const item = {
          worker_id: (c.workers as any)?.id || c.worker_id,
          contract_id: c.id,
          cpf: cpfClean,
          pis: pisClean,
        };
        if (cpfClean) workerByCpf.set(cpfClean, item);
        if (pisClean) workerByPis.set(pisClean, item);
      }
    }

    let maxNsr = device.last_nsr || 0;
    const punchesToUpsert = [];

    for (const item of records) {
      const nsr = typeof item.nsr === 'number' ? item.nsr : parseInt(item.nsr, 10);
      if (isNaN(nsr)) continue;

      if (nsr > maxNsr) {
        maxNsr = nsr;
      }

      const cleanCpf = cleanDigits(item.cpf);
      const cleanPis = cleanDigits(item.pis);

      let matched = (cleanPis && workerByPis.get(cleanPis)) || (cleanCpf && workerByCpf.get(cleanCpf));

      punchesToUpsert.push({
        tenant_id: device.tenant_id,
        company_id: device.company_id,
        device_id: device.id,
        nsr,
        record_type: item.record_type || 3,
        punched_at: item.punched_at,
        cpf: matched?.cpf || (cleanCpf.length === 11 ? cleanCpf : null),
        pis: matched?.pis || (cleanPis ? cleanPis : null),
        worker_id: matched?.worker_id || null,
        contract_id: matched?.contract_id || null,
        source: 'REP',
        raw_line: item.raw_line || null,
        crc_ok: item.crc_ok ?? true,
      });
    }

    // 5. Inserir em lote no banco com tratamento de conflito (idempotência por device_id + nsr)
    if (punchesToUpsert.length > 0) {
      const { error: insertError } = await supabase
        .from('time_punch_records')
        .upsert(punchesToUpsert, { onConflict: 'device_id, nsr', ignoreDuplicates: true });

      if (insertError) {
        throw new Error(`Erro ao persistir batidas: ${insertError.message}`);
      }

      // Atualizar last_nsr e last_sync_at no dispositivo
      await supabase
        .from('time_devices')
        .update({
          last_nsr: maxNsr,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', device.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        received_count: records.length,
        processed_count: punchesToUpsert.length,
        last_nsr: maxNsr,
        sync_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno no processamento do lote.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
