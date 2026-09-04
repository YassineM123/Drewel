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
const hardcodedTexts = [];

dartFiles.forEach(f => {
  if (f.includes('app_translations.dart') || f.includes('points_translations.dart')) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check for Text('something') without .tr
    // Check for hintText: 'something' without .tr
    // Check for labelText: 'something' without .tr
    // Check for title: Text('something')
    const textMatch = line.match(/(?:Text|title|hintText|labelText|TextSpan|tooltip)\s*\(\s*['"]([^'"]{3,})['"]/);
    if (textMatch) {
      const matchedStr = textMatch[1];
      if (!line.includes('.tr') && !matchedStr.startsWith('http') && !matchedStr.startsWith('assets/') && !matchedStr.startsWith('+') && !matchedStr.includes('{') && !matchedStr.includes('$')) {
        // check if it looks like English words
        if (/[a-zA-Z]{3,}/.test(matchedStr)) {
          hardcodedTexts.push({ file: f, line: idx + 1, text: matchedStr, code: line.trim() });
        }
      }
    }
  });
});

console.log('Found hardcoded UI texts:', hardcodedTexts.length);
console.log(JSON.stringify(hardcodedTexts.slice(0, 50), null, 2));
