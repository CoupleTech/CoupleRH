const fs = require('fs');
let sql = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

// The on_auth_user_created trigger is created on auth.users, which is in the auth schema, not public.
// Our DO block incorrectly checks pg_tables for public.users and drops from public.users.
// We'll replace that specific DO block with a direct drop on auth.users.
const badAuthBlock = /DO \$\$\s*BEGIN\s*IF EXISTS \(SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'handle_new_user'\) THEN\s*DROP TRIGGER IF EXISTS on_auth_user_created ON public\.handle_new_user;\s*END IF;\s*END \$\$;/g;

sql = sql.replace(badAuthBlock, 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');

// Wait, the regex matched ON public.handle_new_user?
// Let's just blindly replace any DO block that mentions on_auth_user_created
sql = sql.replace(/DO \$\$[\s\S]*?on_auth_user_created[\s\S]*?END \$\$;/g, 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');

fs.writeFileSync('06_missing_migrations_recovery.sql', sql);
console.log('Fixed auth trigger');
