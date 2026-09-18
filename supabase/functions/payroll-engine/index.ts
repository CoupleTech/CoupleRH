// FORCE DEPLOY TIMESTAMP 12345
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { PayrollContext, Rubric } from "./engine/PayrollContext.ts";
import { PayrollEngine } from "./engine/PayrollEngine.ts";
import { EmployerTaxesCalculator, LaborConfig } from "./legal/EmployerTaxesCalculator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// BUG R3 fix: Traduz valores de calculation_form/calculation_type entre os formatos
// da tela (inglês: FIXED, HOURS, DAYS) e do motor (português: FIXO, HORAS, DIAS)
function normalizeCalcForm(value: string): string {
  const map: Record<string, string> = {
    'FIXED': 'FIXO',
    'HOURS': 'HORAS',
    'DAYS': 'DIAS',
    'PERCENTAGE_OF_BASE': 'PERCENTUAL',
    'PERCENTAGE': 'PERCENTUAL',
    'REFERENCE_TABLE': 'AUTOMATICA',
    'FORMULA': 'FORMULA',
    'MANUAL': 'MANUAL',
    // Valores já no formato do motor
    'FIXO': 'FIXO',
    'HORAS': 'HORAS',
    'DIAS': 'DIAS',
    'PERCENTUAL': 'PERCENTUAL',
    'AUTOMATICA': 'AUTOMATICA',
    'BASE': 'BASE',
    'REFERENCIA': 'REFERENCIA',
    'QUANTIDADE_X_VALOR': 'QUANTIDADE_X_VALOR',
  };
  return map[value] || value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const period_id = body.period_id;
    const contract_id_filter = body.contract_id; // Optional: run for a specific contract

    if (!period_id) throw new Error("period_id is required");

    // Inicializa o cliente do Supabase com a Service Role Key para ter acesso total
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase Environment Variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Busca a competência (Período de Folha)
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', period_id)
      .single();

    if (periodError || !period) throw new Error("Period not found");
    if (['CONFERENCE', 'CLOSED', 'CANCELED'].includes(period.status)) {
      throw new Error(`A folha está no status ${period.status} e não pode ser recalculada. Por favor, volte o status para rascunho (reabrir) se precisar alterar.`);
    }

    // 0.4 Buscar Feriados
    const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(period.year, period.month, 0).getDate();
    const endDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    
    const { data: dbHolidays, error: hError } = await supabase
      .from('holidays')
      .select('date')
      .eq('status', 'ACTIVE')
      .gte('date', startDate)
      .lte('date', endDate);
      
    const holidaysSet = new Set((dbHolidays || []).map((h: any) => h.date));

    const tenant_id = period.tenant_id;
    const company_id = period.company_id;

    if (!company_id) throw new Error("A competência não possui uma empresa associada. O cálculo deve ser por empresa.");

    let queryContracts = supabase
      .from('employment_contracts')
      .select('id, worker_id, company_id, base_salary, status, admission_date, receives_advance, work_schedules(weekly_hours), contract_types(has_inss, has_fgts)')
      .eq('tenant_id', tenant_id)
      .eq('company_id', company_id)
      .eq('status', 'ACTIVE');
      
    if (contract_id_filter) {
      queryContracts = queryContracts.eq('id', contract_id_filter);
    }

    const { data: contracts, error: contractsError } = await queryContracts;
      
    if (contractsError) throw contractsError;

    // 3. Busca Rubricas
    const { data: dbRubrics, error: rubricsError } = await supabase
      .from('payroll_rubrics')
      .select('*')
      .eq('tenant_id', tenant_id)
      .neq('is_active', false);
      
    if (rubricsError) throw rubricsError;

    // Busca Configurações Trabalhistas das Empresas do Tenant
    const { data: companies } = await supabase
      .from('companies')
      .select('id, labor_config')
      .eq('tenant_id', tenant_id);

    // 3.1 Busca Benefícios Ativos
    const { data: employeeBenefits } = await supabase
      .from('employee_benefits')
      .select(`
        contract_id,
        custom_discount_value,
        benefits_catalog (
          id,
          name,
          discount_type,
          default_discount_value,
          rubric_id
        )
      `)
      .eq('tenant_id', tenant_id)
      .eq('status', 'ACTIVE');

    // 3.2 Busca Eventos Variáveis da Competência
    const { data: variableEvents } = await supabase
      .from('payroll_variable_events')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('period_id', period_id);

    // 3.3 Busca Descontos Fixos (empréstimos, pensões, etc.)
    const { data: employeeDeductions } = await supabase
      .from('employee_deductions')
      .select('*, payroll_rubrics (id, code, name, type)')
      .eq('tenant_id', tenant_id);

    // 3.4 Busca Adicionais e Proventos Fixos (insalubridade, etc.)
    const { data: employeeFixedEvents } = await supabase
      .from('employee_fixed_events')
      .select('*, payroll_rubrics (id, code, name, type)')
      .eq('tenant_id', tenant_id);

    // 3.4.2 Busca Dependentes (BUG 5 fix - dependentes nunca eram carregados)
    const { data: allDependents } = await supabase
      .from('dependents')
      .select('id, person_id, is_irrf_dependent, is_family_allowance_dependent, birth_date')
      .eq('tenant_id', tenant_id)
      .eq('is_irrf_dependent', true);

    // 3.4.1 Busca Versão de Parâmetros Legais Ativa para a Competência
    const periodStartDate = new Date(period.year, period.month - 1, 1).toISOString().split('T')[0];
    const { data: legalVersions } = await supabase
      .from('legal_versions')
      .select('id, version_name')
      .lte('valid_from', periodStartDate)
      .order('valid_from', { ascending: false });

    let inss_parameters = [];
    let irrf_parameters = [];
    let general_legal_parameters = {};
    
    if (legalVersions && legalVersions.length > 0) {
      // Pega a versão mais recente válida ou a que não tem valid_to ou que valid_to >= periodStartDate
      // Como o Supabase JS não suporta um filtro complexo OR nativamente na mesma query sem string, fazemos no JS para MVP
      const { data: lv2 } = await supabase
        .from('legal_versions')
        .select('id')
        .lte('valid_from', periodStartDate)
        .or(`valid_to.gte.${periodStartDate},valid_to.is.null`)
        .order('valid_from', { ascending: false })
        .limit(1);

      const activeVersionId = (lv2 && lv2.length > 0) ? lv2[0].id : legalVersions[0].id;

      const { data: inssData } = await supabase.from('inss_parameters').select('*').eq('version_id', activeVersionId).order('bracket_number');
      const { data: irrfData } = await supabase.from('irrf_parameters').select('*').eq('version_id', activeVersionId).order('bracket_number');
      const { data: generalData } = await supabase.from('general_legal_parameters').select('*').eq('version_id', activeVersionId).limit(1);

      inss_parameters = inssData || [];
      irrf_parameters = irrfData || [];
      general_legal_parameters = (generalData && generalData.length > 0) ? generalData[0] : {};
    }

    const rubricas = dbRubrics.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      category: r.category,
      // BUG R3 fix: Normaliza valores de calculation_form/calculation_type para o formato do motor
      calculation_form: normalizeCalcForm(r.calculation_form || r.calculation_type || 'FIXED'),
      calculation_base: r.calculation_base,
      percentage: r.percentage,
      quantity: r.quantity,
      divisor: r.divisor,
      factor: r.factor,
      formula: r.formula,
      calculation_order: r.calculation_order || 100,
      incidencias: {
        inss: r.incidence_inss || false,
        irrf: r.incidence_irrf || false,
        fgts: r.incidence_fgts || false,
        // Compatibilidade: aceita nomes antigos (inss_patronal_incidence) e novos (incidence_inss_patronal)
        inss_patronal: r.inss_patronal_incidence || r.incidence_inss_patronal || false,
        rat: r.rat_incidence || r.incidence_rat || false,
        terceiros: r.terceiros_incidence || r.incidence_third_parties || false,
        // Compatibilidade: aceita nomes antigos (generates_inss_base) e novos (generates_base_inss)
        gera_base_inss: r.generates_inss_base || r.generates_base_inss || r.incidence_inss || false,
        gera_base_irrf: r.generates_irrf_base || r.generates_base_irrf || r.incidence_irrf || false,
        gera_base_fgts: r.generates_fgts_base || r.generates_base_fgts || r.incidence_fgts || false,
      }
    } as Rubric));

    // 3.5 Busca Adiantamentos (se for folha MENSAL) para realizar o Desconto
    let advancePayslips: any[] = [];
    if (period.type === 'MONTHLY') {
      const { data: advData } = await supabase
        .from('payslips')
        .select('contract_id, total_earnings, payroll_periods!inner(type, month, year, status)')
        .eq('tenant_id', tenant_id)
        .eq('payroll_periods.type', 'ADVANCE')
        .eq('payroll_periods.month', period.month)
        .eq('payroll_periods.year', period.year)
        .eq('payroll_periods.status', 'CLOSED');
        
      if (advData) {
        advancePayslips = advData;
      }
    }

    // 3.6 Busca Férias (VACATION ou MONTHLY)
    // Para VACATION: Gera os recibos. Para MONTHLY: Ajusta dias trabalhados.
    // Vamos buscar solicitações de férias onde o mês de start_date coincide com a competência.
    // (Para um sistema avançado, verificaríamos sobreposições exatas de dias. No MVP: pega férias que iniciam no mês).
    const startOfMonth = new Date(period.year, period.month - 1, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(period.year, period.month, 0).toISOString().split('T')[0];

    const { data: vacationRequests } = await supabase
      .from('vacation_requests')
      .select('*, vacation_vesting_periods!inner(contract_id)')
      .eq('tenant_id', tenant_id)
      .gte('start_date', startOfMonth)
      .lte('start_date', endOfMonth)
      .in('status', ['APPROVED_DP', 'PAID', 'TAKEN']);

    const vacations = (vacationRequests || []).map(v => ({
      ...v,
      contract_id: v.vacation_vesting_periods.contract_id
    }));

    // 3.7 Busca Adiantamentos de 13º para Desconto (se for THIRTEENTH_2)
    let thirteenthAdvances: any[] = [];
    if (period.type === 'THIRTEENTH_2') {
      const { data: thirteenthData } = await supabase
        .from('payslip_items')
        .select('amount, payslips!inner(contract_id, payroll_periods!inner(year, status)), payroll_rubrics!inner(code)')
        .eq('payslips.tenant_id', tenant_id)
        .eq('payslips.payroll_periods.year', period.year)
        .in('payroll_rubrics.code', ['602', '405'])
        .in('payslips.payroll_periods.status', ['CLOSED', 'CONFERENCE', 'CALCULATED']); // Aceita calculados para flexibilidade de recálculo no mesmo mês
      
      if (thirteenthData) {
        thirteenthAdvances = thirteenthData;
      }
    }

    // Limpa holerites e impostos anteriores para garantir idempotência do recálculo
    let payslipsQuery = supabase.from('payslips').delete().eq('period_id', period_id);
    let taxesQuery = supabase.from('payroll_company_taxes').delete().eq('period_id', period_id);

    if (contract_id_filter) {
      payslipsQuery = payslipsQuery.eq('contract_id', contract_id_filter);
      // Se processar apenas 1 contrato, a reconstrução da tabela de company_taxes fica comprometida.
      // O ideal é a company_taxes ser gerada só no fechamento, mas no MVP ignoramos delete se for contrato único.
    } else {
      await taxesQuery;
    }
    await payslipsQuery;

    const results = [];
    const companyTotals: Record<string, { base_inss: number, base_fgts: number }> = {};

    // 4. Processa o Motor para cada Contrato
    for (const contract of contracts || []) {
      
      const eventos: any[] = [];
      let applicableRubrics = rubricas;

      if (period.type === 'ADVANCE') {
        // Se o funcionário optou por não receber adiantamento, pula ele
        if (contract.receives_advance === false) continue;

        // Folha de Adiantamento: Filtra pela rubrica de Adiantamento
        applicableRubrics = rubricas.filter(r => r.code === '301' || (r.name && r.name.toLowerCase().includes('adiantamento')));
        // BUG 12 fix: Era 'const', causava TypeError ao reatribuir
        let rubricAdvEarning = applicableRubrics[0];

        if (!rubricAdvEarning) {
          // Cria a rubrica no BD para não estourar FK UUID e aparecer no recibo
          const newRub = {
            tenant_id,
            code: '301',
            name: 'Adiantamento Quinzenal',
            type: 'EARNING',
            category: 'ADVANCE',
            calculation_form: 'FIXO', // Pro adiantamento o valor é fixo gerado antes
            calculation_type: 'FIXED',
            percentage: 40,
            incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
          };
          const { data: inserted } = await supabase.from('payroll_rubrics').insert(newRub).select().single();
          if (inserted) {
             rubricAdvEarning = inserted;
             rubricas.push(inserted);
             applicableRubrics.push(inserted);
          } else {
             // Fallback pra não crachar o motor se der erro no insert
             rubricAdvEarning = { ...newRub, id: 'rubrica-adiantamento-virtual' } as any;
             applicableRubrics.push(rubricAdvEarning);
          }
        }

        if (rubricAdvEarning) {
          eventos.push({
            rubric_id: rubricAdvEarning.id,
            manual_value: contract.base_salary * ((rubricAdvEarning.percentage || 40) / 100),
            quantity: 1
          });
        }
      } else if (period.type === 'VACATION') {
        const contractVacation = vacations.find(v => v.vesting_period_id && v.days_taken > 0); // Simplificado: acha a solicitação dele
        // Precisa cruzar contract_id, mas a tabela vacation_requests não tem contract_id direto, 
        // tem vesting_period_id que aponta para contract_id.
        // Como 'vacations' foi puxada sem join, precisamos ajustar a query lá em cima.
        
        // Temporário até ajustar a query lá em cima:
        // Vamos supor que a query retornou o contract_id no join
        const req = vacations.find(v => v.contract_id === contract.id);
        
        if (req) {
           applicableRubrics = rubricas.filter(r => ['401', '402', '403', '404', '405'].includes(r.code) || ['INSS_AUTO', 'IRRF_AUTO'].includes(r.code) || r.name.includes('INSS') || r.name.includes('IRRF'));
           
           const r401 = applicableRubrics.find(r => r.code === '401');
           if (r401) eventos.push({ rubric_id: r401.id, manual_value: (contract.base_salary / 30) * req.days_taken, quantity: req.days_taken });
           
           const r402 = applicableRubrics.find(r => r.code === '402');
           if (r402) eventos.push({ rubric_id: r402.id, manual_value: ((contract.base_salary / 30) * req.days_taken) / 3, quantity: 1 });
           
           if (req.cash_allowance_days > 0) {
              const r403 = applicableRubrics.find(r => r.code === '403');
              if (r403) eventos.push({ rubric_id: r403.id, manual_value: (contract.base_salary / 30) * req.cash_allowance_days, quantity: req.cash_allowance_days });
              
              const r404 = applicableRubrics.find(r => r.code === '404');
              if (r404) eventos.push({ rubric_id: r404.id, manual_value: ((contract.base_salary / 30) * req.cash_allowance_days) / 3, quantity: 1 });
           }
           
           if (req.advance_13th_salary) {
              const r405 = applicableRubrics.find(r => r.code === '405');
              if (r405) eventos.push({ rubric_id: r405.id, manual_value: contract.base_salary / 2, quantity: 1 });
           }
        }
      } else if (period.type === 'THIRTEENTH_1' || period.type === 'THIRTEENTH_2') {
         // Lógica do 13º Salário
         let avos = 12;
         if (contract.admission_date) {
            const admParts = contract.admission_date.split('-');
            const admYear = parseInt(admParts[0]);
            const admMonth = parseInt(admParts[1]);
            const admDay = parseInt(admParts[2]);

            if (admYear === period.year) {
               // Admitido no mesmo ano
               avos = 12 - admMonth + 1;
               // Regra: se admitido dia 17 pra frente (menos de 15 dias trabalhados no mês), perde 1 avo
               if (admDay > 17) {
                  avos -= 1;
               }
            } else if (admYear > period.year) {
               avos = 0; // Não devia nem processar
            }
         }
         
         if (avos < 0) avos = 0;
         
         if (period.type === 'THIRTEENTH_1') {
            applicableRubrics = rubricas.filter(r => r.code === '602');
            const r602 = applicableRubrics[0];
            if (r602 && avos > 0) {
               eventos.push({ rubric_id: r602.id, manual_value: ((contract.base_salary / 12) * avos) / 2, quantity: avos });
            }
         } else if (period.type === 'THIRTEENTH_2') {
            applicableRubrics = rubricas.filter(r => ['601', '608'].includes(r.code) || ['INSS_AUTO', 'IRRF_AUTO'].includes(r.code) || r.name.includes('INSS') || r.name.includes('IRRF'));
            
            const r601 = applicableRubrics.find(r => r.code === '601');
            if (r601 && avos > 0) {
               eventos.push({ rubric_id: r601.id, manual_value: (contract.base_salary / 12) * avos, quantity: avos });
            }
            
            // Verifica descontos de adiantamento de 13º (rubricas 405 e 602 pagas no ano)
            const contractAdvances = thirteenthAdvances.filter(a => a.payslips.contract_id === contract.id);
            let totalAdvance = 0;
            for (const adv of contractAdvances) {
               totalAdvance += Number(adv.amount);
            }
            
            if (totalAdvance > 0) {
               const r608 = applicableRubrics.find(r => r.code === '608');
               if (r608) {
                  eventos.push({ rubric_id: r608.id, manual_value: totalAdvance, quantity: 1 });
               }
            }
         }

      } else {
        // Folha Mensal/Outras: Exclui rubricas de adiantamento, férias e 13º
        applicableRubrics = rubricas.filter(r => {
           if (!r.code && !r.name) return true;
           const c = r.code || '';
           const n = (r.name || '').toLowerCase();
           if (['301', '401', '402', '403', '404', '405', '601', '602', '608'].includes(c)) return false;
           if (n.includes('adiantamento') || n.includes('férias') || n.includes('13º') || n.includes('décimo terceiro')) return false;
           return true;
        });

        // BUG 1 fix: Busca salário base por código '101' OU '1001' (compatibilidade com rubricas manuais)
        const salarioRubric = applicableRubrics.find(r => r.code === '101' || r.code === '1001' || (r.name && (r.name.toLowerCase().includes('salário base') || r.name.toLowerCase().includes('salario base'))));
        if (salarioRubric) {
          eventos.push({ rubric_id: salarioRubric.id, quantity: 30, manual_value: 0 });
        }


        // Injeta Benefícios como eventos manuais
        const contractBenefits = employeeBenefits?.filter(b => b.contract_id === contract.id) || [];
        for (const eb of contractBenefits) {
          const catalog = Array.isArray(eb.benefits_catalog) ? eb.benefits_catalog[0] : eb.benefits_catalog;
          if (!catalog || !catalog.rubric_id || catalog.discount_type === 'NONE') continue;

          const discountVal = eb.custom_discount_value !== null ? eb.custom_discount_value : catalog.default_discount_value;
          
          let calculatedValue = 0;
          if (catalog.discount_type === 'PERCENTAGE') {
            calculatedValue = contract.base_salary * (discountVal / 100);
          } else if (catalog.discount_type === 'FIXED_VALUE') {
            calculatedValue = discountVal;
          }

          if (calculatedValue > 0) {
            eventos.push({
              rubric_id: catalog.rubric_id,
              manual_value: calculatedValue,
              quantity: 1
            });
          }
        }

      // Injeta Eventos Variáveis (lançamentos manuais do mês)
      const contractVars = variableEvents?.filter(v => v.contract_id === contract.id) || [];
      for (const v of contractVars) {
        eventos.push({
          rubric_id: v.rubric_id,
          manual_value: v.amount,
          quantity: v.quantity || 1
        });
      }

      // Injeta Adicionais e Proventos Fixos (Insalubridade, Periculosidade, etc)
      const contractFixedEvents = employeeFixedEvents?.filter(fe => {
         if (fe.contract_id !== contract.id) return false;
         if (!fe.is_active) return false;
         
         const periodStart = new Date(period.year, period.month - 1, 1);
         const periodEnd = new Date(period.year, period.month, 0);
         
         const feStart = new Date(fe.start_date);
         if (feStart > periodEnd) return false;
         
         if (fe.end_date) {
           const feEnd = new Date(fe.end_date);
           if (feEnd < periodStart) return false;
         }
         return true;
      }) || [];

      for (const fe of contractFixedEvents) {
        eventos.push({
          rubric_id: fe.rubric_id,
          manual_value: fe.value,
          quantity: fe.quantity || 1
        });
      }

      // Injeta Desconto de Adiantamento se houver na competência
      if (period.type === 'MONTHLY') {
        const contractAdvance = advancePayslips.find(a => a.contract_id === contract.id);
        if (contractAdvance && contractAdvance.total_earnings > 0) {
          let rubricAdvDeduction = applicableRubrics.find(r => r.code === '801');
          if (!rubricAdvDeduction) {
             // Procura na lista global pois applicableRubrics excluiu itens com "adiantamento" no nome antes
             rubricAdvDeduction = rubricas.find(r => r.code === '801' || (r.name && r.name.toLowerCase().includes('desconto de adiantamento') && r.type === 'DEDUCTION'));
             if (rubricAdvDeduction) applicableRubrics.push(rubricAdvDeduction);
          }
          if (!rubricAdvDeduction) {
             const newRub = {
                tenant_id,
                code: '801',
                name: 'Desconto de Adiantamento',
                type: 'DEDUCTION',
                category: 'ADVANCE',
                calculation_form: 'FIXO',
                calculation_type: 'FIXED',
                incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
             };
             const { data: inserted } = await supabase.from('payroll_rubrics').insert(newRub).select().single();
             if (inserted) {
                 rubricAdvDeduction = inserted;
                 rubricas.push(inserted);
                 applicableRubrics.push(inserted);
             } else {
                 rubricAdvDeduction = { ...newRub, id: 'rubrica-desc-adiantamento-virtual' } as any;
                 applicableRubrics.push(rubricAdvDeduction);
             }
          }
          if (rubricAdvDeduction) {
             eventos.push({
               rubric_id: rubricAdvDeduction.id,
               manual_value: contractAdvance.total_earnings,
               quantity: 1
             });
          }
        }
      }
    } // End of else (period.type !== 'ADVANCE')

    // ==========================================
    // DEDUÇÕES FIXAS (TODAS AS FOLHAS MENSAL/ADVANCE)
    // ==========================================
    const contractDeductions = employeeDeductions?.filter(d => {
       if (d.contract_id !== contract.id) return false;
       if (d.is_active === false) return false;
       
       if (period.type === 'ADVANCE' && d.deduct_on_advance !== true) return false;
       if (period.type === 'MONTHLY' && d.deduct_on_advance === true) return false;
       
       const periodDate = new Date(period.year, period.month - 1, 1);
       if (d.start_date && new Date(d.start_date) > new Date(period.year, period.month, 0)) return false;
       if (d.end_date && new Date(d.end_date) < periodDate) return false;
       
       return true;
    }) || [];
    
    for (const d of contractDeductions) {
      if (d.rubric_id && d.value > 0) {
        eventos.push({
          rubric_id: d.rubric_id,
          manual_value: d.value,
          quantity: 1
        });
        
        // BUG FIX: Garante que a rubrica de dedução conste em applicableRubrics (vital p/ folha de Adiantamento)
        if (!applicableRubrics.find(r => r.id === d.rubric_id)) {
            const rub = rubricas.find(r => r.id === d.rubric_id);
            if (rub) applicableRubrics.push(rub);
        }
      }
    }

      // Calcula dias trabalhados proporcionais (parse manual para evitar timezone)
      let diasTrabalhados = 30;
      if (contract.admission_date) {
        const admParts = contract.admission_date.split('-');
        const admDate = new Date(parseInt(admParts[0]), parseInt(admParts[1]) - 1, parseInt(admParts[2]));
        const startOfMonth = new Date(period.year, period.month - 1, 1);
        
        if (admDate > startOfMonth) {
           // Empregado admitido neste mês
           // Fórmula padrão de DP: 30 - dia_admissao + 1 (em meses de 31 dias, limita-se a 30)
           diasTrabalhados = 30 - admDate.getDate() + 1;
           if (diasTrabalhados > 30) diasTrabalhados = 30;
        }
      }

      // Subtrai dias de férias no mês (se for MENSAL)
      if (period.type === 'MONTHLY') {
         const req = vacations.find(v => v.contract_id === contract.id);
         if (req) {
            // Conta quantos dias caem neste mês
            const fStart = new Date(req.start_date);
            const fEnd = new Date(req.end_date);
            const mStart = new Date(period.year, period.month - 1, 1);
            const mEnd = new Date(period.year, period.month, 0);

            const calcStart = fStart > mStart ? fStart : mStart;
            const calcEnd = fEnd < mEnd ? fEnd : mEnd;

            if (calcStart <= calcEnd) {
               const overlapDays = Math.round((calcEnd.getTime() - calcStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
               diasTrabalhados -= overlapDays;
               if (diasTrabalhados < 0) diasTrabalhados = 0;
            }
         }
      }

      // Calcula dias úteis e inúteis do mês
      let dias_uteis = 0;
      let dias_inuteis = 0;
      const daysInMonth = new Date(period.year, period.month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(period.year, period.month - 1, day);
        const dateStr = `${period.year}-${String(period.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (d.getDay() === 0 || holidaysSet.has(dateStr)) { // Domingo ou Feriado
          dias_inuteis++;
        } else {
          dias_uteis++;
        }
      }
      
      // Normaliza para 30 dias se for mensalista, para que a soma seja 30 (ajuste contábil padrão)
      if (dias_uteis + dias_inuteis > 30) {
         dias_uteis = 30 - dias_inuteis;
         if (dias_uteis < 0) dias_uteis = 0;
      } else if (dias_uteis + dias_inuteis < 30) {
         dias_uteis = 30 - dias_inuteis;
      }

      // Calcula o Divisor baseado na jornada de trabalho
      let divisor = 220; // Default CLT 44h
      const schedule = Array.isArray(contract.work_schedules) ? contract.work_schedules[0] : contract.work_schedules;
      if (schedule && schedule.weekly_hours) {
          divisor = (schedule.weekly_hours / 6) * 30;
      }

      // BUG 5 fix: Contar dependentes para IRRF
      // Relação: contract → worker_id → workers → person_id → dependents(person_id)
      let numDependentesIRRF = 0;
      if (allDependents && allDependents.length > 0) {
        // Busca o person_id do worker deste contrato
        const { data: workerData } = await supabase
          .from('workers')
          .select('person_id')
          .eq('id', contract.worker_id)
          .single();
        
        if (workerData?.person_id) {
          numDependentesIRRF = allDependents.filter(d => d.person_id === workerData.person_id).length;
        }
      }

      const contextData = {
        competencia: `${period.month}/${period.year}`,
        tipo_folha: period.type,
        empregado_id: contract.worker_id,
        contrato_id: contract.id,
        salario_base: contract.base_salary,
        dias_trabalhados: diasTrabalhados,
        dias_uteis: dias_uteis,
        dias_inuteis: dias_inuteis,
        divisor: divisor,
        num_dependentes: numDependentesIRRF,
        rubricas: applicableRubrics,
        eventos: eventos,
        contract_incidences: contract.contract_types,
        inss_parameters: inss_parameters,
        irrf_parameters: irrf_parameters,
        general_legal_parameters: general_legal_parameters
      };

      const context = new PayrollContext(contextData);
      const engine = new PayrollEngine(context);
      const result = await engine.run();

      // 4.5 Ajuste para Folha Complementar
      if (period.type === 'COMPLEMENTARY' && period.parent_period_id) {
        const { data: originalPayslip } = await supabase
          .from('payslips')
          .select('id, total_earnings, total_deductions, payslip_items(rubric_id, amount)')
          .eq('period_id', period.parent_period_id)
          .eq('contract_id', contract.id)
          .single();

        if (originalPayslip && originalPayslip.payslip_items) {
          for (const mem of result.memoria_calculo) {
             const originalItem = originalPayslip.payslip_items.find((i: any) => i.rubric_id === mem.rubric_id);
             if (originalItem) {
                mem.result_value = Math.max(0, mem.result_value - originalItem.amount);
             }
          }
          
          result.total_proventos = 0;
          result.total_descontos = 0;
          for (const mem of result.memoria_calculo) {
             if (mem.result_value > 0 && mem.rubric_id.includes('-')) {
                const rub = rubricas.find(r => r.id === mem.rubric_id);
                if (rub?.type === 'EARNING') result.total_proventos += mem.result_value;
                if (rub?.type === 'DEDUCTION') result.total_descontos += mem.result_value;
             }
          }
          result.liquido = result.total_proventos - result.total_descontos;
          
          // Note: for MVP we do not recalculate bases explicitly after subtraction, 
          // they usually remain as total simulated bases minus what was paid.
          // Adjusting bases for purely complementary reports can be done later if needed.
        }
      }

      // 5. Salva o cabeçalho do holerite
      const { data: payslip, error: payslipError } = await supabase
        .from('payslips')
        .insert({
          tenant_id,
          period_id,
          contract_id: contract.id,
          total_earnings: result.total_proventos,
          total_deductions: result.total_descontos,
          net_salary: result.liquido,
          base_inss: result.bases.inss,
          base_irrf: result.bases.irrf,
          base_fgts: result.bases.fgts,
          fgts_month: result.total_fgts,
          status: 'CALCULATED',
          engine_version: '1.0.0',
          rubrics_version: '1.0.0',
          rules_version: '1.0.0',
          inss_table_version: '2026.1',
          irrf_table_version: '2026.1',
          fgts_table_version: '1.0.0'
        })
        .select()
        .single();
        
      if (payslipError) throw payslipError;

      // 6. Salva os itens e memória de cálculo
      // BUG 8 fix: Validar rubric_id contra UUIDs reais ao invés de usar .includes('-')
      const validRubricIds = new Set(rubricas.map(r => r.id));
      const itemsToInsert = [];
      for (const mem of result.memoria_calculo) {
        if (mem.result_value > 0) {
           // Insere apenas rubricas cadastradas no BD (UUID válido)
           if (validRubricIds.has(mem.rubric_id)) {
              const rub = rubricas.find(r => r.id === mem.rubric_id);
              itemsToInsert.push({
                tenant_id,
                payslip_id: payslip.id,
                rubric_id: mem.rubric_id,
                reference: mem.quantity_used ? mem.quantity_used.toString() : '',
                amount: mem.result_value,
                type: rub ? rub.type : 'EARNING'
              });
           }
        }
      }
      
      if (itemsToInsert.length > 0) {
         await supabase.from('payslip_items').insert(itemsToInsert);
      }

      const memToInsert = result.memoria_calculo.map(m => ({
          tenant_id,
          payslip_id: payslip.id,
          step_name: m.step_name,
          base_value: m.base_value,
          quantity_used: m.quantity_used,
          percentage_used: m.percentage_used,
          parsed_formula: m.parsed_formula,
          result_value: m.result_value,
          origin: m.origin,
          engine_version: '1.0.0'
      }));
      await supabase.from('payroll_memory_calc').insert(memToInsert);

      // Acumula bases para impostos patronais da empresa
      const cId = contract.company_id;
      if (cId) {
          if (!companyTotals[cId]) companyTotals[cId] = { base_inss: 0, base_fgts: 0 };
          companyTotals[cId].base_inss += result.bases.inss;
          companyTotals[cId].base_fgts += result.bases.fgts;
      }

      results.push({ contract_id: contract.id, net: result.liquido, status: result.status });
    }

    // 6.5 Calcula e Salva Impostos Patronais por Empresa
    const companyTaxesToInsert = [];
    for (const cId of Object.keys(companyTotals)) {
       const totals = companyTotals[cId];
       const comp = companies?.find(c => c.id === cId);
       const laborConfig = comp?.labor_config as LaborConfig;
       
       const taxes = EmployerTaxesCalculator.calculate(totals.base_inss, totals.base_fgts, laborConfig);
       
       companyTaxesToInsert.push({
           tenant_id,
           period_id,
           company_id: cId,
           total_base_inss: totals.base_inss,
           total_base_fgts: totals.base_fgts,
           inss_patronal: taxes.inss_patronal,
           rat_adjusted: taxes.rat_adjusted,
           terceiros: taxes.terceiros,
           fgts_patronal: taxes.fgts_patronal,
           total_taxes: taxes.total
       });
    }

    if (companyTaxesToInsert.length > 0) {
       await supabase.from('payroll_company_taxes').insert(companyTaxesToInsert);
    }

    // 7. Atualiza data de processamento e status para CALCULATED
    await supabase.from('payroll_periods').update({ 
      processing_date: new Date().toISOString(),
      status: 'CALCULATED'
    }).eq('id', period_id);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
