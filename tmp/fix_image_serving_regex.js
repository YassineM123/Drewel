import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\anoth\\Downloads\\drewel-wp-changes\\drewel-wp-changes\\drewel-backend\\src\\controllers\\userController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Use a regex that ignores any whitespace between characters
const regex = /export\s+const\s+getProfileImage\s*=\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{\s*try\s*\{[\s\S]*?res\.sendFile\(\s*filePath\s*\);\s*\}\s*catch\s*\(error\)\s*\{/;

const newFuncHead = `export const getProfileImage = async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).send("File name is required");

    const rootDir = path.join(__dirname, "../../public");
    const possiblePaths = [
      path.join(rootDir, "user-images", fileName),
      path.join(rootDir, "driver-documents", fileName),
    ];

    let fileToServe = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        fileToServe = p;
        break;
      }
    }

    if (!fileToServe) {
      return res.status(404).send("File not found");
    }

    res.setHeader("Content-Disposition", "inline; filename=" + fileName);
    res.sendFile(fileToServe);
  } catch (error) {`;

if (regex.test(content)) {
    content = content.replace(regex, newFuncHead);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated userController.js using Regex');
} else {
    console.error('Regex did not match the code block in userController.js');
}
