const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: rows, error: err } = await supabase.from('payroll_rubrics').select('calculation_order').limit(1);
  console.log("Error:", err);
  if (rows) console.log("Rows:", rows);
}
run();
