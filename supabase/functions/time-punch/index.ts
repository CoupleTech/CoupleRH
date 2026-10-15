import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
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
    const { contract_id, geo, device_fingerprint, entry_type = 'IN' } = body;

    if (!contract_id) {
      return new Response(
        JSON.stringify({ error: "contract_id é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar usuário autenticado via JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar contrato, empresa e lotação/workplace
    const { data: contract, error: contractError } = await supabase
      .from('employment_contracts')
      .select(`
        id, tenant_id, company_id, is_telework,
        companies(id, corporate_name, cnpj),
        workers(id, person_id, people(cpf, full_name, user_id)),
        workplaces(id, name, latitude, longitude, radius_meters, enforce_geofence)
      `)
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: "Contrato não encontrado." }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validação de Geofence
    const workplace = (contract as any).workplaces;
    const isTelework = contract.is_telework ?? false;

    if (!isTelework && workplace && workplace.enforce_geofence && workplace.latitude && workplace.longitude) {
      if (!geo || typeof geo.latitude !== 'number' || typeof geo.longitude !== 'number') {
        return new Response(
          JSON.stringify({ error: "Geolocalização obrigatória para este local de trabalho." }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const distance = calculateHaversineDistance(
        workplace.latitude,
        workplace.longitude,
        geo.latitude,
        geo.longitude
      );

      const radius = workplace.radius_meters || 200;
      if (distance > radius) {
        return new Response(
          JSON.stringify({
            error: `Fora do perímetro permitido de marcação de ponto. Distância atual: ${distance}m (máximo: ${radius}m).`,
            distance_meters: distance,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Anti-duplicação (Debounce de 60 segundos)
    const { data: recentPunch } = await supabase
      .from('time_entries')
      .select('original_timestamp')
      .eq('contract_id', contract_id)
      .order('original_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPunch) {
      const elapsedSeconds = (Date.now() - new Date(recentPunch.original_timestamp).getTime()) / 1000;
      if (elapsedSeconds < 60) {
        return new Response(
          JSON.stringify({
            error: `Marcação repetida recente: aguarde ${Math.ceil(60 - elapsedSeconds)} segundos para registrar o ponto novamente.`,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Registrar atômico no banco com carimbo do servidor
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;

    const { data: punchResult, error: rpcError } = await supabase.rpc('register_mobile_punch', {
      p_contract_id: contract_id,
      p_geo: geo || null,
      p_device_fingerprint: device_fingerprint || null,
      p_ip: clientIp,
      p_receipt_code: null,
      p_entry_type: entry_type,
    });

    if (rpcError || !punchResult || punchResult.length === 0) {
      return new Response(
        JSON.stringify({ error: `Falha ao registrar batida: ${rpcError?.message || 'Erro desconhecido'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = punchResult[0];
    const company = (contract as any).companies;
    const worker = (contract as any).workers;
    const person = worker?.people;

    const cleanCnpj = company?.cnpj?.replace(/\D/g, '') || '';
    const cleanCpf = person?.cpf?.replace(/\D/g, '') || '';
    const verificationUrl = `https://couplerh.com.br/verificar-ponto?nsr=${row.nsr}&cnpj=${cleanCnpj}&h=${row.receipt_code.substring(0, 16)}`;

    return new Response(
      JSON.stringify({
        success: true,
        punch: {
          id: row.punch_id,
          nsr: row.nsr,
          punched_at: row.punched_at,
          receipt_code: row.receipt_code,
        },
        receipt: {
          nsr: row.nsr,
          punched_at: row.punched_at,
          receipt_code: row.receipt_code,
          company_name: company?.corporate_name,
          company_cnpj: cleanCnpj,
          worker_name: person?.full_name,
          worker_cpf: cleanCpf,
          qr_code_payload: `${verificationUrl}&cpf=${cleanCpf}&hash=${row.receipt_code}`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno no processamento do ponto.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
