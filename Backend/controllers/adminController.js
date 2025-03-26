import Admin from "../models/adminModel.js";
import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Booking from "../models/bookingModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Generate tokens for admin
const generateAdminTokens = (adminId) => {
  const accessToken = jwt.sign({ adminId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "1d",
  });

  const refreshToken = jwt.sign({ adminId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

// Admin login controller
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const { accessToken, refreshToken } = generateAdminTokens(admin._id);
    

    // Set token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Return success with admin data (excluding password)
    const adminData = {
      _id: admin._id,
      name: admin.name,
      email: admin.email
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      admin: adminData,
      accessToken,
    
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

// Admin logout controller
export const adminLogout = async (req, res) => {
  try {
    // Since we're using localStorage for token storage in the frontend,
    // we don't need to clear cookies on the server

    res.clearCookie("refreshToken");
    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during logout"
    });
  }
};

// Get admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    return res.status(200).json({
      success: true,
      admin
    });
  } catch (error) {
    console.error("Get admin profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching admin profile"
    });
  }
};

// Get all doctors
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({}).select("-password");
    res.json(doctors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all bookings
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("user", "-password")
      .populate("doctor", "-password");
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve a doctor
export const approveDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const parseName = (fullName) => {
      const nameParts = fullName.trim().split(" ");
      if (nameParts.length > 2) {
        return {
          firstName: nameParts[1], // Ignore title
          lastName: nameParts.slice(2).join(" "), // Join remaining parts
        };
      }
      return {
        firstName: nameParts[0],
        lastName: nameParts[1] || "", // Handle single-word names
      };
    };

    const { firstName, lastName } = parseName(doctor.name);

    // Approve the doctor
    doctor.isApproved = true;
    await doctor.save();

    

    // Stripe request payload
    const stripePayload = new URLSearchParams();
    stripePayload.append("type", "custom");
    stripePayload.append("country", "US");
    stripePayload.append("email", doctor.email);
    stripePayload.append("business_type", "individual");
    stripePayload.append("capabilities[transfers][requested]", "true");
    stripePayload.append("capabilities[card_payments][requested]", "true");
    stripePayload.append("business_profile[url]", "https://docradar.com");
    stripePayload.append("business_profile[mcc]", "8099");
    stripePayload.append("individual[first_name]", firstName);
    stripePayload.append("individual[last_name]", lastName);
    stripePayload.append("individual[email]", doctor.email);
    stripePayload.append("individual[phone]", "+18005551234");
    stripePayload.append("individual[address][line1]", "123 Street");
    stripePayload.append("individual[address][city]", "New York");
    stripePayload.append("individual[address][state]", "NY");
    stripePayload.append("individual[address][postal_code]", "10001");
    stripePayload.append("individual[dob][day]", "12");
    stripePayload.append("individual[dob][month]", "12");
    stripePayload.append("individual[dob][year]", "1998");
    stripePayload.append("tos_acceptance[date]", "1742766194");
    stripePayload.append("tos_acceptance[ip]", "192.168.1.1");
    stripePayload.append("external_account", "btok_us_verified");
    stripePayload.append("individual[id_number]", "000000000");

    // Make request to Stripe API
    const stripeResponse = await axios.post(
      "https://api.stripe.com/v1/accounts",
      stripePayload.toString(),
      {
        headers: {
          Authorization: `Bearer ${process.env.stripekey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    

    // Save Stripe account ID in the doctor model
    if (stripeResponse.data && stripeResponse.data.id) {
      doctor.stripeAccountId = stripeResponse.data.id;
      await doctor.save();
    }

    res.json({
      message: "Doctor approved successfully",
      doctor,
      stripeAccount: stripeResponse.data.id,
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.status(500).json({
      message: "Server error",
      error: error.response?.data || error.message,
    });
  }
};



// Delete a doctor
export const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Delete associated bookings
    await Booking.deleteMany({ doctor: doctorId });

    // Remove doctor from users' bookings
    await User.updateMany(
      { bookings: { $in: doctor.bookings } },
      { $pull: { bookings: { $in: doctor.bookings } } }
    );

    // Delete the doctor
    await Doctor.findByIdAndDelete(doctorId);

    res.json({ message: "Doctor deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get doctor approval requests (doctors who are not yet approved)
export const getDoctorApprovalRequests = async (req, res) => {
  try {
    const pendingDoctors = await Doctor.find({ isApproved: false }).select("-password");
    res.json(pendingDoctors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId); 

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


