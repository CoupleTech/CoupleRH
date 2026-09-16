import { supabase } from '../lib/supabase';

export const leaveService = {
  /**
   * Busca todos os afastamentos enriquecidos com dados do colaborador (evita joins profundos).
   */
  getEnrichedLeaves: async () => {
    const { data: leaves, error: leavesError } = await supabase
      .from('leaves')
      .select('*')
      .order('start_date', { ascending: false });
      
    if (leavesError) throw leavesError;

    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, people(full_name, cpf), employment_contracts(id, company_id)');
      
    if (workersError) throw workersError;

    const contractToWorker = new Map();
    workers?.forEach(w => {
      // @ts-ignore
      w.employment_contracts?.forEach(c => {
        contractToWorker.set(c.id, {
          // @ts-ignore
          full_name: w.people?.full_name,
          // @ts-ignore
          cpf: w.people?.cpf,
          company_id: c.company_id
        });
      });
    });

    return leaves?.map(l => ({
      ...l,
      employment_contracts: {
        company_id: contractToWorker.get(l.contract_id)?.company_id || null,
        workers: {
          people: contractToWorker.get(l.contract_id) || null
        }
      }
    }));
  },

  /**
   * Busca os afastamentos de um contrato específico.
   */
  getLeavesByContract: async (contractId: string) => {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('contract_id', contractId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo registro de afastamento.
   */
  createLeave: async (leaveData: any) => {
    const { data, error } = await supabase
      .from('leaves')
      .insert([leaveData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza o status de um afastamento.
   */
  updateLeaveStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('leaves')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
