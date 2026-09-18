const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// Fix duplicated IF NOT EXISTS
sql = sql.replace(/IF NOT EXISTS IF NOT EXISTS/g, 'IF NOT EXISTS');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed double IF NOT EXISTS in the recovery script.');
