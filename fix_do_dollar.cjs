const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// The replacement generated DO $ instead of DO $$
// Let's replace DO $ with DO $$
// But carefully, because END $; also exists.
sql = sql.replace(/DO \$/g, 'DO $$');
sql = sql.replace(/END \$;/g, 'END $$;');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed DO $ syntax error to DO $$');
