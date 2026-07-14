import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from './src/models/Admin.js';

dotenv.config();

const checkAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    const admins = await Admin.find({});
    console.log('Admin Users:', admins.length);
    admins.forEach(admin => {
        console.log(`- Email: ${admin.email}, Role: ${admin.role}, Name: ${admin.fullName}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkAdmins();
