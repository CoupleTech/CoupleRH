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
    const { email, full_name, role_id, role, worker_id } = await req.json();

    if (!email || !full_name || (!role_id && !role)) {
      throw new Error("Parâmetros inválidos: informe e-mail, nome completo e o perfil desejado.");
    }

    // Verifica de qual tenant o usuário que está convidando pertence
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

    // Resolver role textual a partir da role_id se não fornecida
    let effectiveRole = role;
    if (!effectiveRole && role_id) {
      const { data: roleRow } = await supabaseAdmin
        .from("roles")
        .select("name")
        .eq("id", role_id)
        .maybeSingle();

      if (roleRow) {
        const roleName = roleRow.name.toLowerCase();
        if (roleName.includes("administrador") || roleName.includes("admin")) effectiveRole = "tenant_admin";
        else if (roleName.includes("analista") || roleName.includes("dp")) effectiveRole = "dp_analyst";
        else if (roleName.includes("sst")) effectiveRole = "sst_specialist";
        else if (roleName.includes("gestor")) effectiveRole = "manager";
        else if (roleName.includes("contador") || roleName.includes("fiscal")) effectiveRole = "accountant";
        else if (roleName.includes("auditor")) effectiveRole = "auditor";
        else effectiveRole = "employee";
      }
    }
    if (!effectiveRole) {
      effectiveRole = "employee";
    }

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

    // 2. Sincronizar user_profiles com o nome e e-mail reais
    await supabaseAdmin
      .from("user_profiles")
      .upsert({
        id: targetUserId,
        email: email,
        full_name: full_name,
        updated_at: new Date().toISOString(),
      });

    // 3. Inserir ou atualizar na tabela tenant_users com role obrigatória, worker_id e is_active
    const { error: upsertTenantUserError } = await supabaseAdmin
      .from("tenant_users")
      .upsert({
        tenant_id: tenantId,
        user_id: targetUserId,
        role: effectiveRole,
        role_id: role_id || null,
        worker_id: worker_id || null,
        is_active: true,
      }, { onConflict: 'tenant_id,user_id' });

    if (upsertTenantUserError) {
      throw upsertTenantUserError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Usuário convidado e vinculado com sucesso!",
        user_id: targetUserId,
        role: effectiveRole,
      }),
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
