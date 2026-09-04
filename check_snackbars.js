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
const snackbars = [];

dartFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('snackbar') || line.includes('showSnackBar') || line.includes('DrewelSnackBar') || line.includes('showToast')) {
      snackbars.push({ file: f, line: idx + 1, code: line.trim() });
    }
  });
});

console.log('Found snackbar/toast calls:', snackbars.length);
snackbars.forEach(s => console.log(`${s.file}:${s.line} --> ${s.code}`));
