import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Driver from './src/models/Driver.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    const count = await Driver.countDocuments();
    console.log('Total Drivers:', count);
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    console.log('Online Drivers:', onlineDrivers);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

connectDB();
