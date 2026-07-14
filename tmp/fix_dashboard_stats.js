import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\anoth\\Downloads\\drewel-wp-changes\\drewel-wp-changes\\drewel-backend\\src\\controllers\\userController.js';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /export const dashBoardData = async \(req, res\) => \{\s*try \{\s*const totalUsers = await User\.countDocuments\(\);\s*const totalDrivers = await Driver\.countDocuments\(\);\s*return res\.status\(200\)\.send\(\{[\s\S]*?\}\);/m;

const newDashboardFunc = `export const dashBoardData = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    const restrictedDrivers = await User.countDocuments({ isRestricted: true });

    return res.status(200).send({
      success: true,
      message: "Dashboard data fetched",
      dashBoardData: {
        totalUsers,
        totalDrivers,
        onlineDrivers,
        restrictedDrivers,
      },
    });`;

if (regex.test(content)) {
    content = content.replace(regex, newDashboardFunc);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated dashBoardData in userController.js');
} else {
    console.error('Regex did not match dashBoardData block in userController.js');
}
