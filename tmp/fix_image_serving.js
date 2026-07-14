import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\anoth\\Downloads\\drewel-wp-changes\\drewel-wp-changes\\drewel-backend\\src\\controllers\\userController.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(200).send("File name is required");
    }

    const directoryPath = path.join(__dirname, "../../public/user-images");

    if (!fs.existsSync(directoryPath)) {
      return res.status(500).send("Directory not found");
    }

    const filePath = path.join(directoryPath, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(200).send("File not found");
    }

    res.setHeader("Content-Disposition", "inline; filename=" + fileName);
    res.sendFile(filePath);
  } catch (error) {`;

const newCode = `  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).send("File name is required");

    const possiblePaths = [
      path.join(__dirname, "../../public/user-images", fileName),
      path.join(__dirname, "../../public/driver-documents", fileName),
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

// Use a more robust search and replace that ignores exact line endings if possible, 
// but here we just try to replace the block.
if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated userController.js');
} else {
    console.error('Could not find the target code block in userController.js');
    // Log the actual area to debug
    const startIdx = content.indexOf('export const getProfileImage');
    if (startIdx !== -1) {
        console.log('Area around target:\n' + content.substring(startIdx, startIdx + 500));
    }
}
