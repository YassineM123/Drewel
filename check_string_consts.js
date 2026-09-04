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
const stringConstUsages = [];

dartFiles.forEach(f => {
  if (f.includes('string_constants.dart')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const matches = [...line.matchAll(/StringConstants\.([a-zA-Z0-9_]+)/g)];
    matches.forEach(m => {
      const prop = m[1];
      if (prop !== 'defaultEventImage' && prop !== 'defaultNetworkImage' && prop !== 'test') {
        const regex = new RegExp(`StringConstants\\.${prop}\\.tr`);
        if (!regex.test(line)) {
          stringConstUsages.push({ file: f, line: idx + 1, prop, code: line.trim() });
        }
      }
    });
  });
});

console.log('Found StringConstants without .tr:', stringConstUsages.length);
stringConstUsages.forEach(u => console.log(`${u.file}:${u.line} [${u.prop}] -> ${u.code}`));
