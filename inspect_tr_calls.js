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

const appTransContent = fs.readFileSync('lib/app/data/constants/app_translations.dart', 'utf8');
const pointsTransContent = fs.readFileSync('lib/app/modules/points/points_translations.dart', 'utf8');

function extractKeys(content) {
  const keys = new Set();
  const regex = /'([a-zA-Z0-9_.\s\-?]+)':/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

const allDefinedKeys = extractKeys(appTransContent);
for (const k of extractKeys(pointsTransContent)) allDefinedKeys.add(k);

const dartFiles = walk('lib');
const trCalls = [];

dartFiles.forEach(f => {
  if (f.includes('app_translations.dart') || f.includes('points_translations.dart')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.tr')) {
      trCalls.push({ file: f, line: idx + 1, code: line.trim() });
    }
  });
});

console.log('Total .tr calls in app:', trCalls.length);
console.log('Sample .tr calls:');
trCalls.forEach(t => console.log(`${t.file}:${t.line} -> ${t.code}`));
