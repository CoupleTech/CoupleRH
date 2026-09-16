import { supabase } from '../lib/supabase';

export const vacationService = {
  /**
   * Busca os períodos aquisitivos de um contrato.
   */
  getVestingPeriodsByContract: async (contractId: string) => {
    const { data, error } = await supabase
      .from('vacation_vesting_periods')
      .select('*')
      .eq('contract_id', contractId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Busca as solicitações (recibos) de férias de um período aquisitivo específico.
   */
  getVacationRequestsByVestingPeriod: async (vestingPeriodId: string) => {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('vesting_period_id', vestingPeriodId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo período aquisitivo manualmente.
   */
  createVestingPeriod: async (periodData: any) => {
    const { data, error } = await supabase
      .from('vacation_vesting_periods')
      .insert([periodData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Registra uma nova solicitação/gozo de férias.
   */
  createVacationRequest: async (requestData: any) => {
    const { data, error } = await supabase
      .from('vacation_requests')
      .insert([requestData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Busca os períodos aquisitivos enriquecidos com dados do colaborador (evita joins profundos).
   */
  getEnrichedVestingPeriods: async () => {
    const { data: periods, error: periodsError } = await supabase
      .from('vacation_vesting_periods')
      .select('*')
      .order('start_date', { ascending: false });
    if (periodsError) throw periodsError;

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
          cpf: w.people?.cpf
        });
      });
    });

    return periods?.map(p => ({
      ...p,
      employment_contracts: {
        company_id: contractToWorker.get(p.contract_id)?.company_id || null,
        workers: {
          people: contractToWorker.get(p.contract_id) || null
        }
      }
    }));
  },

  /**
   * Busca as solicitações de férias enriquecidas com dados do colaborador.
   */
  getEnrichedRequests: async () => {
    const { data: requests, error: reqError } = await supabase
      .from('vacation_requests')
      .select('*')
      .order('start_date', { ascending: false });
    if (reqError) throw reqError;

    const { data: periods, error: periodsError } = await supabase
      .from('vacation_vesting_periods')
      .select('id, contract_id');
    if (periodsError) throw periodsError;

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
          cpf: w.people?.cpf
        });
      });
    });

    const periodToWorker = new Map();
    periods?.forEach(p => {
      periodToWorker.set(p.id, contractToWorker.get(p.contract_id) || null);
    });

    return requests?.map(r => ({
      ...r,
      vacation_vesting_periods: {
        employment_contracts: {
          company_id: periodToWorker.get(r.vesting_period_id)?.company_id || null,
          workers: {
            people: periodToWorker.get(r.vesting_period_id) || null
          }
        }
      }
    }));
  }
};
