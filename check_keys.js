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
  const regex = /'([a-zA-Z0-9_.]+)':/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

const allDefinedKeys = new Set([...extractKeys(appTransContent), ...extractKeys(pointsTransContent)]);

const dartFiles = walk('lib');
const usedKeys = new Set();
const missingKeys = [];

dartFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const regex = /['"]([a-zA-Z0-9_.]+)['"]\s*\.tr/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const key = m[1];
    usedKeys.add(key);
    if (!allDefinedKeys.has(key)) {
      missingKeys.push({ file: f, key });
    }
  }
});

console.log('Total used .tr keys in codebase:', usedKeys.size);
console.log('Missing keys count:', missingKeys.length);
console.log('Missing keys from translation maps:', JSON.stringify(missingKeys, null, 2));
