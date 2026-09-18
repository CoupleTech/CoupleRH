const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

// Let's include everything from 00025 up to 00059 to be absolutely safe.
const missingFiles = files.filter(f => {
    const num = parseInt(f.substring(0, 5));
    return num >= 25;
});

let combinedSQL = '-- MISSING MIGRATIONS RECOVERY SCRIPT\n\n';

for (const file of missingFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Make idempotent
    sql = sql.replace(/CREATE TABLE public\./g, 'CREATE TABLE IF NOT EXISTS public.');
    sql = sql.replace(/ALTER TABLE public\.([a-zA-Z0-9_]+)\s+ADD COLUMN public\./g, 'ALTER TABLE public.$1 ADD COLUMN IF NOT EXISTS public.');
    sql = sql.replace(/ALTER TABLE public\.([a-zA-Z0-9_]+)\s+ADD COLUMN/g, 'ALTER TABLE public.$1 ADD COLUMN IF NOT EXISTS');
    
    // Fix double IF NOT EXISTS
    sql = sql.replace(/ADD COLUMN IF NOT EXISTS IF NOT EXISTS/g, 'ADD COLUMN IF NOT EXISTS');

    sql = sql.replace(/CREATE VIEW/g, 'CREATE OR REPLACE VIEW');
    sql = sql.replace(/CREATE FUNCTION/g, 'CREATE OR REPLACE FUNCTION');
    
    // Idempotent policies
    sql = sql.replace(/CREATE POLICY "([^"]+)" ON public\.([a-zA-Z0-9_]+)/g, 'DROP POLICY IF EXISTS "$1" ON public.$2;\nCREATE POLICY "$1" ON public.$2');
    
    // Idempotent triggers using DO block to prevent 42P01 (relation does not exist)
    sql = sql.replace(/CREATE TRIGGER ([a-zA-Z0-9_]+)[\s\S]*?ON public\.([a-zA-Z0-9_]+)/g, 
`DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '$2') THEN
        DROP TRIGGER IF EXISTS $1 ON public.$2;
    END IF;
END $$;
$&`);

    // Specific fixes
    if (file === '00059_payroll_periods_company.sql') {
        sql = sql.replace(/ALTER TABLE public\.payroll_periods/g, '-- ALTER TABLE public.payroll_periods');
    }
    
    combinedSQL += `-- ==========================================\n`;
    combinedSQL += `-- Source: ${file}\n`;
    combinedSQL += `-- ==========================================\n\n`;
    combinedSQL += sql + '\n\n';
}

combinedSQL += "NOTIFY pgrst, 'reload schema';\n";

fs.writeFileSync('06_missing_migrations_recovery.sql', combinedSQL);
console.log('Recovery script regenerated with tables from 00025 and robust trigger drops.');
