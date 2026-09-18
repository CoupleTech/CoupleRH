const fs = require('fs');
let sql = fs.readFileSync('05_bulletproof_schema.sql', 'utf8');

// 1. Remove the first CREATE TABLE public.payroll_periods block
const firstBlockStart = sql.indexOf('CREATE TABLE IF NOT EXISTS public.payroll_periods (');
const firstBlockEndStr = '    UNIQUE(tenant_id, competence_month, competence_year, payroll_type)\n);\n';
const firstBlockEnd = sql.indexOf(firstBlockEndStr) + firstBlockEndStr.length;

if (firstBlockStart > -1 && firstBlockEnd > firstBlockStart && firstBlockStart < 20000) {
    sql = sql.substring(0, firstBlockStart) + sql.substring(firstBlockEnd);
    console.log('Removed first payroll_periods block');
} else {
    console.log('Could not find first payroll_periods block precisely. First start:', firstBlockStart, 'End:', firstBlockEnd);
}

// 2. Modify the second CREATE TABLE public.payroll_periods block (which is now the only one, or first one if we deleted the other)
const secondBlockStart = sql.indexOf('CREATE TABLE IF NOT EXISTS public.payroll_periods (');
if (secondBlockStart > -1) {
    // We want to add company_id, parent_period_id, complement_reason
    const targetInsertPoint = sql.indexOf('    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),', secondBlockStart);
    if (targetInsertPoint > -1) {
        const columnsToAdd = `    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_period_id UUID REFERENCES public.payroll_periods(id),
    complement_reason TEXT,
`;
        sql = sql.substring(0, targetInsertPoint) + columnsToAdd + sql.substring(targetInsertPoint);
        
        // Update UNIQUE constraint
        sql = sql.replace(
            'UNIQUE(tenant_id, month, year, type)',
            'UNIQUE(tenant_id, company_id, month, year, type)'
        );
        
        console.log('Updated the correct payroll_periods block');
    }
}

// Write it back
fs.writeFileSync('05_bulletproof_schema.sql', sql);
console.log('Done cleaning 05_bulletproof_schema.sql');
