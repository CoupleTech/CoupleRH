import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await supabase.auth.signInWithPassword({ email: 'cf95.souza@gmail.com', password: '140415' });
  const tenant_id = '4c96671c-c518-4ba3-b507-ab3eaa9d79b5';
  
  // 1. Apaga lixo virtual
  console.log("Inserindo rubrica de adiantamento...");
  const res = await supabase.from('payroll_rubrics').insert({
    tenant_id,
    code: '301',
    name: 'Adiantamento Quinzenal',
    type: 'EARNING',
    category: 'ADVANCE',
    calculation_type: 'FIXED',
    calculation_form: 'FIXO',
    calculation_base: 'SALARIO_BASE',
    percentage: 40,
    calculation_order: 5,
    is_active: true,
    esocial_code: '5501'
  });
  console.log("Inseriu?", res.error || res.data);
  
  const { data: periods } = await supabase.from('payroll_periods').select('id, type').eq('year', 2026).eq('month', 9).eq('type', 'ADVANCE');
  if (periods && periods.length) {
     console.log("Reprocessando Adiantamento...");
     const { data, error } = await supabase.functions.invoke('payroll-engine', { body: { period_id: periods[0].id } });
     console.log(error || data);
  }
}
run();
