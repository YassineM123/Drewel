import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from './src/models/Admin.js';

dotenv.config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const email = 'admin@example.com';
        const password = 'Password@123';

        const admin = await Admin.findOne({ email });
        if (!admin) {
            console.log('Admin not found');
            return;
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            console.log('Invalid credentials');
            return;
        }

        console.log('Password matched');

        if (!process.env.JWT_SECRET) {
            console.log('Error: JWT_SECRET is missing');
            return;
        }

        const token = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET);
        console.log('Token generated:', token.substring(0, 20) + '...');
        process.exit(0);
    } catch (error) {
        console.error('Error during test:', error.message);
        process.exit(1);
    }
};

testLogin();
