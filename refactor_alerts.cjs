const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const confirmComponentPath = path.join(srcDir, 'components', 'ConfirmDialogProvider').replace(/\\/g, '/');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Track if we need imports
  let needsToast = false;
  let needsConfirm = false;

  // Replace window.alert and alert
  if (/(\bwindow\.alert\b|\balert\b)\s*\(/.test(content)) {
    content = content.replace(/(\bwindow\.alert\b|\balert\b)\s*\(/g, 'toast.error(');
    needsToast = true;
  }

  // Replace window.confirm and confirm
  if (/(\bwindow\.confirm\b|\bconfirm\b)\s*\(/.test(content)) {
    content = content.replace(/(\bwindow\.confirm\b|\bconfirm\b)\s*\(/g, 'await confirmDialog(');
    needsConfirm = true;
  }

  if (needsToast || needsConfirm) {
    // Add imports
    const imports = [];
    if (needsToast && !content.includes("from 'sonner'")) {
      imports.push("import { toast } from 'sonner';");
    }
    
    if (needsConfirm && !content.includes("confirmDialog")) {
      let relativePath = path.relative(path.dirname(filePath), confirmComponentPath).replace(/\\/g, '/');
      if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
      imports.push(`import { confirmDialog } from '${relativePath}';`);
    }

    if (imports.length > 0) {
      // Find the last import line or just put it at the top
      const lines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) lastImportIdx = i;
      }
      
      lines.splice(lastImportIdx + 1, 0, ...imports);
      content = lines.join('\n');
    }

    // Attempt to make functions async if they now use await
    if (needsConfirm) {
      // Replace non-async arrow functions containing await
      // This is a naive regex, but covers common cases: `handleX = () => {`
      // We look for any arrow function definition before `await confirmDialog`
      // Since doing a proper AST transform is complex, we will just globally add async to common patterns
      // Like `const handleDelete = () => {` -> `const handleDelete = async () => {`
      // Or `onClick={() => ` -> `onClick={async () => `
      
      // Let's do a naive pass: replace `(e) => {`, `() => {`, `(id) => {` inside files that have await
      // Wait, a better regex for arrow functions:
      content = content.replace(/(?<!async\s+)([\w\s]*=)\s*(\([^)]*\))\s*=>/g, '$1 async $2 =>');
      content = content.replace(/onClick=\{((?:\([^)]*\))|(?:\w+))\s*=>/g, 'onClick={async $1 =>');
      content = content.replace(/(?<!async\s+)function\s+(\w+)\s*\(/g, 'async function $1(');
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk(srcDir);
console.log('Refactor complete!');
