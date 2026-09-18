const fs = require('fs');
let sql = fs.readFileSync('05_bulletproof_schema.sql', 'utf8');

// Fix constraints in payroll_periods
sql = sql.replace(
    /type TEXT NOT NULL CHECK \(type IN \('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY'\)\),/,
    "type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY', 'COMPLEMENTARY', 'THIRTEENTH_1', 'THIRTEENTH_2', 'PROFIT_SHARING')),"
);

sql = sql.replace(
    /status TEXT NOT NULL DEFAULT 'DRAFT' CHECK \(status IN \('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED'\)\),/,
    "status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'PROCESSING', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED', 'REOPENED')),"
);

fs.writeFileSync('05_bulletproof_schema.sql', sql);
console.log('Fixed CHECK constraints');
