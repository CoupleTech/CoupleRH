const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

const missingFiles = files.filter(f => {
    const num = parseInt(f.substring(0, 5));
    return num >= 36;
});

let combinedSQL = '-- MISSING MIGRATIONS RECOVERY SCRIPT\n\n';

for (const file of missingFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Make idempotent
    sql = sql.replace(/CREATE TABLE public\./g, 'CREATE TABLE IF NOT EXISTS public.');
    sql = sql.replace(/ALTER TABLE public\.([a-zA-Z0-9_]+)\s+ADD COLUMN public\./g, 'ALTER TABLE public.$1 ADD COLUMN IF NOT EXISTS public.');
    sql = sql.replace(/ALTER TABLE public\.([a-zA-Z0-9_]+)\s+ADD COLUMN/g, 'ALTER TABLE public.$1 ADD COLUMN IF NOT EXISTS');
    sql = sql.replace(/CREATE VIEW/g, 'CREATE OR REPLACE VIEW');
    sql = sql.replace(/CREATE FUNCTION/g, 'CREATE OR REPLACE FUNCTION');
    
    // Idempotent policies
    sql = sql.replace(/CREATE POLICY "([^"]+)" ON public\.([a-zA-Z0-9_]+)/g, 'DROP POLICY IF EXISTS "$1" ON public.$2;\nCREATE POLICY "$1" ON public.$2');
    
    // Idempotent triggers
    sql = sql.replace(/CREATE TRIGGER ([a-zA-Z0-9_]+)/g, 'DROP TRIGGER IF EXISTS $1 ON public.table_name_placeholder;\nCREATE TRIGGER $1');
    // It's hard to get the table name for triggers with a simple regex because it's further down. 
    // Let's just do a more complex regex for triggers:
    sql = sql.replace(/CREATE TRIGGER ([a-zA-Z0-9_]+)[\s\S]*?ON public\.([a-zA-Z0-9_]+)/g, 'DROP TRIGGER IF EXISTS $1 ON public.$2;\n$&');

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
console.log('Recovery script regenerated: 06_missing_migrations_recovery.sql');
