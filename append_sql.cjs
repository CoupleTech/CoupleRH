const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.md');
let dbContent = fs.readFileSync(dbPath, 'utf8');

// Remover a linha de conclusão antiga
dbContent = dbContent.replace('*(Conclusão do Banco de Dados - Tabelas Base MVP Completas)*', '');

const filesToAppend = [
  'supabase_sql_fase_7.sql',
  'supabase_sql_fase_8.sql',
  'supabase_sql_fase_9.sql',
  'supabase_sql_fase_10.sql',
  'supabase_sql_fase_11.sql',
  'supabase_sql_fase_12.sql',
  'supabase_sql_fase_13_14.sql'
];

for (const file of filesToAppend) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    dbContent += `\n\n### Script: \`${file}\`\n\`\`\`sql\n${content}\n\`\`\``;
  }
}

dbContent += '\n\n*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*\n';
fs.writeFileSync(dbPath, dbContent);
console.log('Appended SQL scripts to database.md');
