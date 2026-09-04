const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.dart')) {
      results.push(fullPath);
    }
  });
  return results;
}

const dartFiles = walk('lib');
const byFile = {};

dartFiles.forEach(f => {
  if (f.includes('app_translations.dart') || f.includes('points_translations.dart')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const fileItems = [];
  lines.forEach((line, idx) => {
    // Check if line has Text('...') or other UI text attributes
    const matches = [...line.matchAll(/(?:Text|title|hintText|labelText|TextSpan|tooltip|label|semanticLabel)\s*\(\s*['"]([^'"]{2,})['"]/g)];
    matches.forEach(m => {
      const text = m[1];
      if (!line.includes('.tr') && !text.startsWith('http') && !text.startsWith('assets/') && !text.startsWith('+') && !text.startsWith('/') && !text.includes('$') && !/^[0-9\s:.-]+$/.test(text)) {
        if (/[a-zA-Z]{2,}/.test(text) && text !== 'null' && text !== 'true' && text !== 'false' && text !== 'id' && text !== 'key') {
          fileItems.push({ line: idx + 1, text, code: line.trim() });
        }
      }
    });
  });
  if (fileItems.length > 0) {
    byFile[f] = fileItems;
  }
});

console.log('Files with hardcoded UI texts:', Object.keys(byFile).length);
for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n=== ${file} (${items.length} items) ===`);
  items.forEach(it => console.log(`  L${it.line}: [${it.text}] --> ${it.code}`));
}
