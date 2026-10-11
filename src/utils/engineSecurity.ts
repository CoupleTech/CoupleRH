/**
 * Utilitários de segurança, autenticação e autorização para o Payroll Engine (T8)
 */

export const ALLOWED_PAYROLL_ROLES = ['system_admin', 'tenant_admin', 'dp_analyst'] as const;

export const TRUSTED_ORIGINS = [
  'https://couplerh.com.br',
  'https://app.couplerh.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Valida se a origem da requisição CORS é permitida.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (TRUSTED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

/**
 * Retorna os cabeçalhos CORS restritos ao domínio do app.
 */
export function getCorsHeaders(origin: string | null | undefined): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  const selectedOrigin = allowed && origin ? origin : TRUSTED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': selectedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Valida se a role do usuário no tenant permite cálculo/processamento de folha.
 */
export function isRoleAuthorizedForPayroll(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ALLOWED_PAYROLL_ROLES as readonly string[]).includes(role);
}

/**
 * Higieniza o payload de resposta do motor, removendo estritamente dados de debug e logs internos.
 */
export function sanitizeEngineResponse<T extends Record<string, any>>(response: T): Omit<T, 'debug'> {
  const { debug, ...sanitized } = response;
  return sanitized;
}
