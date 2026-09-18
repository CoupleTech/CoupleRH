import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get current user to verify they are authenticated and authorized
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Não autorizado.");
    }

    // Get the request body
    const { email, full_name, role_id } = await req.json();

    if (!email || !full_name || !role_id) {
      throw new Error("Parâmetros inválidos.");
    }

    // Verifica de qual tenant o usuário que está convidando pertence
    // (Por simplicidade, pegaremos o primeiro tenant que ele pertence)
    const { data: tenantData, error: tenantError } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (tenantError || !tenantData) {
      throw new Error("Tenant não encontrado para o usuário atual.");
    }

    const tenantId = tenantData.tenant_id;

    // Use Service Role para criar/convidar o usuário
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Determina a URL de origem baseada no header da requisição
    const origin = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:5173";
    const redirectTo = `${origin.replace(/\/$/, '')}/update-password`;

    // 1. Invitar o usuário no auth
    // O Supabase enviará um email com link mágico para o usuário
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name },
        redirectTo,
      }
    );

    if (inviteError) {
      // Se o usuário já existe, podemos apenas querer adicionar ele ao tenant
      if (inviteError.status === 422 || inviteError.message.includes("already registered")) {
         // O usuário já tem conta, vamos apenas buscá-lo para adicionar ao tenant
         // Por limitações da API, talvez não possamos buscar usuários por email sem permissões estritas
         // Mas se a chamada falhou, retornamos o erro para o frontend.
         throw new Error("Este usuário já possui cadastro. Funcionalidade de vincular usuário existente em desenvolvimento.");
      }
      throw inviteError;
    }

    const newUserId = inviteData.user.id;

    // 2. Opcional: A trigger já insere em user_profiles, 
    // mas precisamos inserir em tenant_users
    const { error: insertTenantUserError } = await supabaseAdmin
      .from("tenant_users")
      .insert({
        tenant_id: tenantId,
        user_id: newUserId,
        role_id: role_id,
        role: 'employee' // Manter a compatibilidade com a RLS antiga temporariamente
      });

    if (insertTenantUserError) {
      throw insertTenantUserError;
    }

    return new Response(
      JSON.stringify({ message: "Usuário convidado com sucesso!" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
