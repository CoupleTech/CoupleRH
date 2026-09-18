const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('type', 'ADVANCE')
    .eq('month', 9)
    .eq('year', 2026);
    
  console.log("Error:", error);
  console.log("Periods:", JSON.stringify(data, null, 2));
}

run();
