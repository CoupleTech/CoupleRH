import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Logando...");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'cf95.souza@gmail.com',
    password: '140415'
  });
  if (authErr) return console.error("Erro de login:", authErr);
  
  console.log("Login OK. Buscando períodos de Setembro de 2026...");
  
  const { data: periods } = await supabase
    .from('payroll_periods')
    .select('id, type, status')
    .eq('year', 2026)
    .eq('month', 9);
    
  console.log("Períodos encontrados:", periods);
  
  if (periods) {
    for (const p of periods) {
      console.log(`\n=============================\nReprocessando período: ${p.type} (${p.id})...`);
      
      const { data, error } = await supabase.functions.invoke('payroll-engine', {
        body: { period_id: p.id }
      });
      
      console.log("Resposta do Edge Function:");
      console.log(error || data);
      
      if (!error && data?.success) {
         console.log(`Buscando holerites gerados para o período ${p.type}...`);
         const { data: payslips } = await supabase
           .from('payslips')
           .select('contract_id, total_earnings, total_deductions, net_salary, payslip_items(rubric_id, reference, amount, payroll_rubrics(name))')
           .eq('period_id', p.id);
           
         console.log(JSON.stringify(payslips, null, 2));
      }
    }
  }
}
run();
