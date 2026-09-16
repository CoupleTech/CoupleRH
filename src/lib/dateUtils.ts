/**
 * Utilitário global para lidar com datas de forma segura no sistema.
 * Impede que o fuso horário local (ex: GMT-3) subtraia horas e mude o dia 
 * de uma data salva no formato YYYY-MM-DD.
 */

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR', { timeZone: 'UTC' });
}
