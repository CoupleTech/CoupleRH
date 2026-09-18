import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    let targetUserId = null;

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
      // Se o usuário já existe, podemos querer apenas adicioná-lo ao tenant
      if (inviteError.status === 422 || inviteError.message?.includes("already registered") || inviteError.message?.includes("already been registered")) {
        // O usuário já tem conta, vamos buscá-lo na tabela pública user_profiles para pegar o ID
        const { data: existingUser, error: findError } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (findError || !existingUser) {
          throw new Error(`Este usuário já possui cadastro global, mas não foi possível localizá-lo para vinculação. Detalhes: ${findError?.message}`);
        }
        targetUserId = existingUser.id;
      } else {
        throw inviteError;
      }
    } else {
      targetUserId = inviteData.user?.id;
    }

    if (!targetUserId) {
      throw new Error("Não foi possível determinar o ID do usuário após o convite/busca.");
    }

    // 2. Inserir na tabela tenant_users com a nova role_id sem forçar a role legacy "employee"
    const { error: insertTenantUserError } = await supabaseAdmin
      .from("tenant_users")
      .insert({
        tenant_id: tenantId,
        user_id: targetUserId,
        role_id: role_id
        // Removido: role: 'employee'
      });

    if (insertTenantUserError) {
      // Ignora erro se o usuário já estiver vinculado à empresa
      if (insertTenantUserError.code === '23505') {
        return new Response(
          JSON.stringify({ message: "Usuário já estava vinculado a esta empresa!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw insertTenantUserError;
    }

    return new Response(
      JSON.stringify({ message: "Usuário convidado/vinculado com sucesso!" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro na Edge Function invite-user:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
