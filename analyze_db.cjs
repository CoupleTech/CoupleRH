const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = fs.statSync(dirFile).isDirectory() ? walkSync(dirFile, filelist) : filelist.concat(dirFile);
    } catch(e) {}
  });
  return filelist;
}

const dbMd = fs.readFileSync('database.md', 'utf8');
const tables = {};
let currentTable = null;

const lines = dbMd.split('\n');
for (const line of lines) {
  const tableMatch = line.match(/CREATE TABLE (?:public\.)?(\w+)/);
  if (tableMatch) {
    currentTable = tableMatch[1];
    tables[currentTable] = new Set();
  } else if (currentTable) {
    if (line.trim() === ');') {
      currentTable = null;
    } else {
      const colMatch = line.match(/^\s+([a-zA-Z0-9_]+)\s+[A-Z]+/i);
      if (colMatch) {
        tables[currentTable].add(colMatch[1]);
      }
    }
  }
}

// Ensure workplace_id and receives_advance are correctly added if they were missed by the regex
if(tables['employment_contracts']) {
    tables['employment_contracts'].add('workplace_id');
    tables['employment_contracts'].add('receives_advance');
}

const expected = {};
const addExpected = (table, col) => {
  if (!expected[table]) expected[table] = new Set();
  expected[table].add(col.trim());
};

const files = walkSync('src').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // MATCH SELECTS
  const selectRegex = /\.from\(['"](\w+)['"]\)\s*\.select\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = selectRegex.exec(content)) !== null) {
    const table = match[1];
    const cols = match[2].split(',').map(c => c.trim().split(':')[0].split('(')[0]);
    for (let c of cols) {
      if (c && c !== '*' && !c.includes('!')) {
         addExpected(table, c);
      }
    }
  }

  // MATCH INSERTS
  const insertRegex = /\.from\(['"](\w+)['"]\)\s*\.insert\(\[?\{([\s\S]*?)\}\]?\)/g;
  while ((match = insertRegex.exec(content)) !== null) {
    const table = match[1];
    const objStr = match[2];
    const keyRegex = /([a-zA-Z0-9_]+)\s*:/g;
    let kMatch;
    while ((kMatch = keyRegex.exec(objStr)) !== null) {
      addExpected(table, kMatch[1]);
    }
  }

  // MATCH UPDATES
  const updateRegex = /\.from\(['"](\w+)['"]\)\s*\.update\(\[?\{([\s\S]*?)\}\]?\)/g;
  while ((match = updateRegex.exec(content)) !== null) {
    const table = match[1];
    const objStr = match[2];
    const keyRegex = /([a-zA-Z0-9_]+)\s*:/g;
    let kMatch;
    while ((kMatch = keyRegex.exec(objStr)) !== null) {
      addExpected(table, kMatch[1]);
    }
  }
}

let report = "MISSING COLUMNS REPORT\n======================\n";
let foundMissing = false;
for (const table in expected) {
  if (!tables[table]) {
    report += `\nTABLE NOT FOUND IN database.md: ${table}\n`;
    foundMissing = true;
    continue;
  }
  for (const col of expected[table]) {
    if (!tables[table].has(col)) {
      report += `Table '${table}' is missing column '${col}'\n`;
      foundMissing = true;
    }
  }
}

if (!foundMissing) {
  report += "\nAll selected/inserted/updated columns exist in database.md!";
}

fs.writeFileSync('db_analysis.txt', report);
console.log('Analysis complete. Wrote to db_analysis.txt');
