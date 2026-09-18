const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// Remove lines containing table_name_placeholder
const lines = sql.split('\n');
const filteredLines = lines.filter(line => !line.includes('table_name_placeholder'));

// Also fix the trigger on_auth_user_created, which is on auth.users, not public.handle_new_user
// In PostgreSQL, trigger goes on the table, not the function.
// In the original migration it was:
// CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
// My regex matched ON public.handle_new_user because it was at the end!
// Let's fix that specific one by replacing:
// DROP TRIGGER IF EXISTS on_auth_user_created ON public.handle_new_user;
// with:
// DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

let newSql = filteredLines.join('\n');
newSql = newSql.replace('DROP TRIGGER IF EXISTS on_auth_user_created ON public.handle_new_user;', 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');

fs.writeFileSync('06_missing_migrations_recovery.sql', newSql);
console.log('Fixed trigger placeholders in the recovery script.');
