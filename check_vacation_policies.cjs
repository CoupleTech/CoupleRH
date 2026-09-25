import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "SELECT polname, polcmd FROM pg_policies WHERE tablename = 'vacation_vesting_periods';"
  });

  if (error) {
    console.error("Error executing SQL via RPC:", error.message);
    
    // Fallback: try using query directly if admin key or something
    console.log("Try checking via psql or user provided script if we can't run this.");
  } else {
    console.log("Policies:", data);
  }
}

checkPolicies();
