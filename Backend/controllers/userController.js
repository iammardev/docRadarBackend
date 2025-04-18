import User from "../models/userModel.js";
import OTP from "../models/otpModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendOTPEmail from "../utils/emailServices.js";
import Doctor from "../models/doctorModel.js";

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "30d",
  });

  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });

  return { accessToken, refreshToken };
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Sign up controller
export const signUp = async (req, res) => {
  try {
    const { name, email, password, number } = req.body;
    

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { number }] });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      number,
      password: hashedPassword,
    });

    if (user) {
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Set refresh token in cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        number: user.number,
        accessToken,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Set refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      number: user.number,
      accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Refresh token controller
export const refreshToken = async (req, res) => {
  try {
    const user = req.user;
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Set new refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot password controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to database
    await OTP.create({
      email,
      otp,
    });

    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otp);

    if (emailSent) {
      res.json({
        message: "OTP sent to your email",
        email, // Return email for frontend reference
      });
    } else {
      res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify OTP controller
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the most recent OTP for this email
    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      // Delete invalid OTP after 3 failed attempts (you could add attempts counter)
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Delete all existing OTPs for this email for security
    await OTP.deleteMany({ email });

    // Generate a temporary token for password reset
    const resetToken = jwt.sign({ email }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "10m",
    });

    res.json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password controller
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    

    // Verify reset token
    const decoded = jwt.verify(resetToken, process.env.JWT_ACCESS_SECRET);
    const email = decoded.email;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Clean up any remaining OTPs
      await OTP.deleteMany({ email });
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Clean up any remaining OTPs for this email
    await OTP.deleteMany({ email });

    res.json({ message: "Password reset successful" });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ message: "Invalid or expired reset token" });
    }
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update profile controller
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update basic fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.number = req.body.number || user.number;

    // Update optional fields
    if (req.body.gender) {
      if (
        !["male", "female", "other"].includes(req.body.gender.toLowerCase())
      ) {
        return res.status(400).json({ message: "Invalid gender value" });
      }
      user.gender = req.body.gender.toLowerCase();
    }

    if (req.body.dateOfBirth) {
      const dob = new Date(req.body.dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      user.dateOfBirth = dob;
    }

    // Check if email or number is already taken by another user
    if (req.body.email || req.body.number) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: user._id } }, // Exclude current user
          {
            $or: [
              { email: req.body.email || user.email },
              { number: req.body.number || user.number },
            ],
          },
        ],
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Email or phone number is already in use",
        });
      }
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      number: updatedUser.number,
      gender: updatedUser.gender,
      dateOfBirth: updatedUser.dateOfBirth,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Change password controller
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const searchDoctorByCategory = async (req, res) => {
  try {
    const { specialty } = req.body;
    
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const doctors = await Doctor.find({
      "specialty" : specialty,
      "isApproved" : true
  });
    
    res.json(doctors || "No doctors found");
  } catch (error) {
    console.error("Search doctor by category error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(doctor || "No doctor found");
  } catch (error) {
    console.error("Get doctor profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
