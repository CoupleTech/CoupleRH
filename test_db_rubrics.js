import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: auth } = await supabase.auth.signInWithPassword({ email: 'cf95.souza@gmail.com', password: '140415' });
  const { data } = await supabase.from('payroll_rubrics').select('*');
  console.log(data);
}
run();
