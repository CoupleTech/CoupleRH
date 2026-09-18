import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://wcvgpnmaryumfcfwyrrj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjdmdwbm1hcnl1bWZjZnd5cnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODQxMDYsImV4cCI6MjEwNTA2MDEwNn0.lro-SBj5JpyOVrDjBe1K3qHMJ5i8Ky82NrDp9VKYqaY');
async function test() {
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cf95.souza@gmail.com',
    password: '140415'
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
    body: { period_id: period.id, company_id: period.company_id }
  });
  console.log('Error:', error);
  if (error && error.context) {
    const text = await error.context.text();
    console.log('Context:', text);
  }
  console.log('Data:', data);
}
test();
