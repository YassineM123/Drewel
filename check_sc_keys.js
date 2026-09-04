const fs = require('fs');
const content = fs.readFileSync('lib/app/data/constants/app_translations.dart', 'utf8');
const scContent = fs.readFileSync('lib/app/data/constants/string_constants.dart', 'utf8');

const scMatches = [...scContent.matchAll(/static const String ([a-zA-Z0-9_]+) = '([^']+)';/g)];

const enMatch = content.match(/'en':\s*<String,\s*String>\{([\s\S]*?)\n\s*\},/);
const enKeys = [];
for (const line of enMatch[1].split('\n')) {
  const m = line.match(/^\s*'([^']+)':/);
  if (m) enKeys.push(m[1]);
}

scMatches.forEach(m => {
  const name = m[1];
  const val = m[2];
  const hasVal = enKeys.includes(val);
  const hasLowerVal = enKeys.includes(val.toLowerCase());
  console.log(`${name}: "${val}" -> exact: ${hasVal}, lower: ${hasLowerVal}`);
});
