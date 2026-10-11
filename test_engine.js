import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cf95.souza@gmail.com',
    password: '140415C@io'
  });
  if (authError) {
    console.log('Auth Error:', authError.message);
    return;
  }
  const { data: period } = await supabase.from('payroll_periods').select('id, company_id').order('created_at', { ascending: false }).limit(1).single();
  if (!period) {
    console.log('No period found');
    return;
  }
  console.log('Invoking function with period_id:', period.id);
  const { data, error } = await supabase.functions.invoke('payroll-engine', {
    body: { period_id: period.id, company_id: period.company_id },
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  console.log('Error:', error);
  if (error && error.context) {
    const text = await error.context.text();
    console.log('Context:', text);
  }
  console.log('Data:', data);
}
test();
