import mongoose from "mongoose";
import Admin from "../models/adminModel.js";
import bcrypt from "bcryptjs";

const createAdminIfNotExists = async () => {
  try {
    console.log("Checking for existing admin...");
    // Check if admin already exists
    const adminExists = await Admin.findOne({ email: "admin@docradar.com" });
    
    if (adminExists) {
      console.log("Admin already exists!");
      return;
    }

    console.log("Creating new admin user...");
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    // Create admin
    const admin = await Admin.create({
      username: "admin",
      email: "admin@docradar.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin created successfully:", admin.username);
  } catch (error) {
    console.error("Error creating admin:", error);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
    });
    console.log(" MongoDB connected successfully");
    
    // Create admin user if it doesn't exist already
    await createAdminIfNotExists();
  } catch (error) {
    console.error(" MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
