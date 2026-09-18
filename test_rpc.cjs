require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    // Pegar o auth ou id de worker, tentar auth.workerId se houver
    const { data: users } = await supabase.from('workers').select('id').limit(1);
    if (users && users.length > 0) {
        const workerId = users[0].id;
        console.log("Testing with workerId:", workerId);
        const { data, error } = await supabase.rpc('get_employee_benefits', { p_worker_id: workerId });
        console.log("Error:", error);
        console.log("Data:", data);
    } else {
        console.log("No workers found.");
    }
}
test();
