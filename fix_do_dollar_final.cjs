const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// Replace any variation of DO $... with DO $$
// The replacement string MUST be DO $$$$ to output DO $$ in Node.js!
sql = sql.replace(/DO\s+\$+/g, 'DO $$$$');
sql = sql.replace(/END\s+\$+;/g, 'END $$$$;');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed DO $$ completely with $$$$');
