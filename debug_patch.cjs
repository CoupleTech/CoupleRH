const fs = require('fs');

try {
  let code = fs.readFileSync('supabase/functions/payroll-engine/index.ts', 'utf8');

  // Add debugLogs declaration ONLY if not present
  if (!code.includes('const debugLogs: any[] = [];')) {
    code = code.replace(
      'serve(async (req) => {',
      'serve(async (req) => {\n  const debugLogs: any[] = [];'
    );
  }

  // Add debug output ONLY if not present
  if (!code.includes('debug: debugLogs')) {
    code = code.replace(
      'JSON.stringify({ success: true, processed: results.length, results }),',
      'JSON.stringify({ success: true, processed: results.length, results, debug: debugLogs }),'
    );
  }

  // Add fetch debug ONLY if not present
  if (!code.includes('error: advErr')) {
    code = code.replace(
      `const { data: advData } = await supabase`,
      `const { data: advData, error: advErr } = await supabase`
    );
  }

  if (!code.includes("step: 'advData fetch'")) {
    code = code.replace(
      `if (advData) {`,
      `debugLogs.push({ step: 'advData fetch', advData, advErr, periodMonth: period.month, periodYear: period.year });\n\n      if (advData) {`
    );
  }

  // Add deduction check debug ONLY if not present
  if (!code.includes("step: 'MONTHLY deduction check'")) {
    code = code.replace(
      `if (contractAdvance && contractAdvance.total_earnings > 0) {`,
      `debugLogs.push({ step: 'MONTHLY deduction check', contractId: contract.id, contractAdvance });\n        if (contractAdvance && contractAdvance.total_earnings > 0) {`
    );
  }

  fs.writeFileSync('supabase/functions/payroll-engine/index.ts', code);
  console.log("Successfully patched without duplicates");
} catch(e) {
  console.error("Error", e);
}
