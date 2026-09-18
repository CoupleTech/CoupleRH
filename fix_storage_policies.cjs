const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// Catch CREATE POLICY with optional newlines before ON
sql = sql.replace(/CREATE POLICY "([^"]+)"\s+ON\s+(storage|auth)\.([a-zA-Z0-9_]+)/g, 'DROP POLICY IF EXISTS "$1" ON $2.$3;\nCREATE POLICY "$1" ON $2.$3');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed policies with newlines');
