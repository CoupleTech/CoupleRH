const fs = require('fs');
let sql = fs.readFileSync('05_bulletproof_schema.sql', 'utf8');

// Find and remove the first definition
// It looks like: CREATE TABLE IF NOT EXISTS public.payroll_periods (\n    id UUID... UNIQUE(tenant_id, competence_month, competence_year, payroll_type)\n);\n
sql = sql.replace(/CREATE TABLE IF NOT EXISTS public\.payroll_periods \([\s\S]*?competence_month[\s\S]*?\);\s*/g, '');

fs.writeFileSync('05_bulletproof_schema.sql', sql);
console.log('Regex cleanup done');
