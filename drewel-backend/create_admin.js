import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Admin from './src/models/Admin.js';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const email = 'admin@example.com';
    const password = 'Password@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log('Admin already exists');
    } else {
      const newAdmin = new Admin({
        fullName: 'Admin User',
        email,
        password: hashedPassword,
        role: 'admin'
      });
      await newAdmin.save();
      console.log('Admin created successfully');
      console.log('Email:', email);
      console.log('Password:', password);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
