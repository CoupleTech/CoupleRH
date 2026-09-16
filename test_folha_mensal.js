import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await supabase.auth.signInWithPassword({ email: 'cf95.souza@gmail.com', password: '140415' });
  const tenant_id = '4c96671c-c518-4ba3-b507-ab3eaa9d79b5';
  
  const { data: periods } = await supabase.from('payroll_periods').select('id, type').eq('year', 2026).eq('month', 9).eq('type', 'MONTHLY');
  if (periods && periods.length) {
     console.log("Reprocessando Mensal...");
     const { data: invokeData, error: invokeErr } = await supabase.functions.invoke('payroll-engine', { body: { period_id: periods[0].id } });
     if (invokeErr) {
         console.error("Invoke Error:", invokeErr);
     }
     console.log("Invoke Result:", invokeData);

     const ana = invokeData?.results?.find(r => r.contract_id === '0a4ef847-4b3b-4bd4-8dc4-3cd8cdd9ac52');
     if (ana) {
         console.log('\nAna Memory:');
         console.log(JSON.stringify(ana, null, 2));
     }

     const { data, error } = await supabase.from('payslips').select(`
        *,
        employment_contracts(*),
        payslip_items(
            *
        )
     `).eq('period_id', periods[0].id);
     
     if (error) {
         console.error("DB ERROR:", error);
         return;
     }

     const anaPayslip = data.find(p => p.contract_id === '0a4ef847-4b3b-4bd4-8dc4-3cd8cdd9ac52');
     if (anaPayslip) {
         console.log('\nAna Payslip Items:');
         console.log(JSON.stringify(anaPayslip.payslip_items, null, 2));
         console.log('\nAna Payslip Memory in DB:');
         // Buscamos a memoria
         const { data: mem } = await supabase.from('payroll_memory_calc').select('*').eq('payslip_id', anaPayslip.id);
         console.log(JSON.stringify(mem, null, 2));
     }

     for (const slip of data) {
         console.log(`\n===========================================`);
         console.log(`Contract: ${slip.contract_id}`);
         console.log(slip);
     }
  }
}
run();
