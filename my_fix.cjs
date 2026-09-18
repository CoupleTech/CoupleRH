const fs = require('fs');
const audit = fs.readFileSync('supabase/migrations/00039_expand_audit_engine.sql', 'utf8');
let safe = fs.readFileSync('06_missing_migrations_recovery.sql', 'utf8');

safe = safe.replace(/DELETE FROM public\.payroll_rubrics/g, '-- DELETE FROM public.payroll_rubrics');
safe = safe.replace(/TRUNCATE TABLE public\.payroll_periods CASCADE;/g, '-- TRUNCATE TABLE public.payroll_periods CASCADE;');
safe = safe.replace(/CREATE POLICY "Users can view employee scales in their tenants"/g, 'DROP POLICY IF EXISTS "Users can view employee scales in their tenants" ON public.employee_scales;\nCREATE POLICY "Users can view employee scales in their tenants"');
safe = safe.replace(/CREATE POLICY "Tenant Admins and DP can manage employee scales"/g, 'DROP POLICY IF EXISTS "Tenant Admins and DP can manage employee scales" ON public.employee_scales;\nCREATE POLICY "Tenant Admins and DP can manage employee scales"');

fs.writeFileSync('10_production_safe_recovery.sql', audit + '\n\n' + safe);

let final = fs.readFileSync('10_production_safe_recovery.sql', 'utf8');
final = final.replace(/IF NOT EXISTS \(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_([a-z_]+)_trigger'\) THEN\n\s+CREATE TRIGGER audit_([a-z_]+)_trigger/g, (match, p1, p2) => 'IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = \'public\' AND tablename = \'' + p1 + '\') THEN\n        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = \'audit_' + p1 + '_trigger\') THEN\n            CREATE TRIGGER audit_' + p1 + '_trigger');
final = final.replace(/EXECUTE FUNCTION audit\.audit_trigger_func\(\);\n\s+END IF;/g, 'EXECUTE FUNCTION audit.audit_trigger_func();\n        END IF;\n    END IF;');

fs.writeFileSync('10_production_safe_recovery.sql', final);
