const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: rows, error: err } = await supabase.from('payroll_rubrics').select('*').limit(1);
  console.log(err);
  if (rows && rows.length > 0) {
    console.log(Object.keys(rows[0]));
  }
}
run();
