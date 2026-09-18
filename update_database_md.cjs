const fs = require('fs');
let db = fs.readFileSync('database.md', 'utf8');

const updates = [
  { table: 'employment_contracts', cols: '    contract_type TEXT,\n    workload_hours NUMERIC,' },
  { table: 'payroll_rubrics', cols: '    calculation_form TEXT,\n    type TEXT,' },
  { table: 'work_schedules', cols: '    status TEXT DEFAULT \'ACTIVE\',' },
  { table: 'payroll_periods', cols: '    month INTEGER,\n    year INTEGER,\n    type TEXT,\n    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,\n    parent_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,\n    complement_reason TEXT,' },
  { table: 'employment_contract_history', cols: '    employment_contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE CASCADE,\n    event_type TEXT,\n    old_value JSONB,\n    new_value JSONB,\n    event_date DATE,' },
  { table: 'payroll_memory_calc', cols: '    logs JSONB,' }
];

for (const u of updates) {
  const tableRegex = new RegExp('CREATE TABLE public.' + u.table + ' \\(\\s*');
  db = db.replace(tableRegex, 'CREATE TABLE public.' + u.table + ' (\n' + u.cols + '\n');
}

fs.writeFileSync('database.md', db, 'utf8');
console.log('database.md updated with missing columns.');
