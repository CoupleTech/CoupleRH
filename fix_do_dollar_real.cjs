const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// The replacement string in JavaScript treats $$ as a single $.
// So we must use $$$$ to get $$ in the output.
sql = sql.replace(/DO \$/g, 'DO $$$$');
sql = sql.replace(/END \$;/g, 'END $$$$;');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed DO $ to DO $$ correctly this time');
