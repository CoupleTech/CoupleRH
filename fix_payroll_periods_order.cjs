const fs = require('fs');
let sql = fs.readFileSync('05_bulletproof_schema.sql', 'utf8');

// The block to extract
const startStr = 'CREATE TABLE IF NOT EXISTS public.payroll_periods (';
const endStr = '    UNIQUE(tenant_id, company_id, month, year, type)\n);\n';

const startIndex = sql.indexOf(startStr);
const endIndex = sql.indexOf(endStr, startIndex) + endStr.length;

if (startIndex > -1 && endIndex > startIndex) {
    const blockToMove = sql.substring(startIndex, endIndex) + '\n\n';
    
    // Remove from original location
    sql = sql.substring(0, startIndex) + sql.substring(endIndex);
    
    // Insert before ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
    const targetStr = 'ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;';
    const targetIndex = sql.indexOf(targetStr);
    
    if (targetIndex > -1) {
        sql = sql.substring(0, targetIndex) + blockToMove + sql.substring(targetIndex);
        fs.writeFileSync('05_bulletproof_schema.sql', sql);
        console.log('Moved payroll_periods successfully.');
    } else {
        console.log('Target string not found.');
    }
} else {
    console.log('Could not find block to extract.');
}
