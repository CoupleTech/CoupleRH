const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('payslips')
    .select('id, contract_id, total_earnings, tenant_id, payroll_periods!inner(type, month, year, status)')
    .eq('payroll_periods.type', 'ADVANCE')
    .eq('payroll_periods.month', 9)
    .eq('payroll_periods.year', 2026);
    
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

run();
