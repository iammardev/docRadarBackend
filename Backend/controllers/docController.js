import Doctor from "../models/doctorModel.js";
import OTP from "../models/otpModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {sendOTPEmail, sendPendingApprovalEmail} from "../utils/emailServices.js";
import geocodeAddress from "../utils/geocodeService.js";

// Generate tokens
const generateTokens = (doctorId) => {
  const accessToken = jwt.sign({ doctorId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "30d",
  });

  const refreshToken = jwt.sign({ doctorId }, process.env.JWT_REFRESH_SECRET, {
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
    const {
      name,
      email,
      password,
      number,
      pmdcNumber,
      totalYearsOfExperience,
      specialty,
      category,
      qualification,
      hospitalDetails,
      clinicExperience,
      hospitalExperience,
      currentCity,
      currentHospital,
      address,
      assistantName,
      schedule,
    } = req.body;

    // Check if doctor exists
    const doctorExists = await Doctor.findOne({
      $or: [{ email }, { number }, { pmdcNumber }],
    });
    if (doctorExists) {
      return res.status(400).json({
        message:
          "Doctor already exists with this email, number, or PMDC number",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Geocode address to get location
    const { location } = await geocodeAddress(address);

    // Default schedule if not provided
    const doctorSchedule = schedule || {
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startTime: "09:00",
      endTime: "17:00",
      slotDuration: 30,
      consultationFee: 0,
    };

    // Create doctor with all fields
    const doctor = await Doctor.create({
      name,
      email,
      password: hashedPassword,
      number,
      pmdcNumber,
      totalYearsOfExperience,
      specialty,
      category,
      qualification,
      hospitalDetails,
      clinicExperience,
      hospitalExperience,
      currentCity,
      currentHospital,
      address,
      assistantName,
      location,
      schedule: doctorSchedule,
    });

    if (doctor) {
      // Send pending approval email
      await sendPendingApprovalEmail(email, name);

      const { accessToken, refreshToken } = generateTokens(doctor._id);

      // Set refresh token in cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Return response with all relevant fields
      res.status(201).json({
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        number: doctor.number,
        pmdcNumber: doctor.pmdcNumber,
        totalYearsOfExperience: doctor.totalYearsOfExperience,
        specialty: doctor.specialty,
        category: doctor.category,
        qualification: doctor.qualification,
        currentCity: doctor.currentCity,
        currentHospital: doctor.currentHospital,
        address: doctor.address,
        assistantName: doctor.assistantName,
        schedule: doctor.schedule,
        isApproved: doctor.isApproved,
        approvalMessage: "Your account has been created successfully. Please wait for admin approval before you can login.",
      });
    }
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find doctor
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if doctor is approved
    if (!doctor.isApproved) {
      return res.status(403).json({ 
        message: "Your account is pending approval. Please wait for admin approval.",
        isPending: true
      });
    }

    const { accessToken, refreshToken } = generateTokens(doctor._id);

    // Set refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      _id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      number: doctor.number,
      pmdcNumber: doctor.pmdcNumber,
      specialty: doctor.specialty,
      schedule: doctor.schedule,
      currentCity: doctor.currentCity,
      currentHospital: doctor.currentHospital,
      accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    // Set emergency availability to false when logging out
    if (req.user && req.user._id) {
      const doctor = await Doctor.findById(req.user._id);
      if (doctor) {
        doctor.emergencyAvailability = false;
        await doctor.save();
      }
    }

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
    const doctor = req.user; // From verifyRefreshToken middleware
    const { accessToken, refreshToken } = generateTokens(doctor._id);

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

// Get doctor profile
export const getDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id).select("-password");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update doctor profile
export const updateDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Update fields
    doctor.name = req.body.name || doctor.name;
    doctor.email = req.body.email || doctor.email;
    doctor.number = req.body.number || doctor.number;
    doctor.specialty = req.body.specialty || doctor.specialty;
    doctor.currentCity = req.body.currentCity || doctor.currentCity;
    doctor.currentHospital = req.body.currentHospital || doctor.currentHospital;

    // If address is updated, update location as well
    if (req.body.address && req.body.address !== doctor.address) {
      doctor.address = req.body.address;
      // Geocode the new address
      const { location } = await geocodeAddress(req.body.address);
      doctor.location = location;
    }

    doctor.hospitalDetails = req.body.hospitalDetails || doctor.hospitalDetails;
    doctor.clinicExperience =
      req.body.clinicExperience || doctor.clinicExperience;
    doctor.hospitalExperience =
      req.body.hospitalExperience || doctor.hospitalExperience;
    doctor.assistantName = req.body.assistantName || doctor.assistantName;

    // Update schedule if provided
    if (req.body.schedule) {
      // Initialize schedule if it doesn't exist
      if (!doctor.schedule) {
        doctor.schedule = {};
      }
      
      // Update schedule fields
      if (req.body.schedule.workingDays) doctor.schedule.workingDays = req.body.schedule.workingDays;
      if (req.body.schedule.startTime) doctor.schedule.startTime = req.body.schedule.startTime;
      if (req.body.schedule.endTime) doctor.schedule.endTime = req.body.schedule.endTime;
      if (req.body.schedule.slotDuration) doctor.schedule.slotDuration = req.body.schedule.slotDuration;
      if (req.body.schedule.consultationFee !== undefined) {
        doctor.schedule.consultationFee = req.body.schedule.consultationFee;
      }
    }

    // Update password if provided
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      doctor.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedDoctor = await doctor.save();
    res.json({
      _id: updatedDoctor._id,
      name: updatedDoctor.name,
      email: updatedDoctor.email,
      number: updatedDoctor.number,
      specialty: updatedDoctor.specialty,
      currentCity: updatedDoctor.currentCity,
      currentHospital: updatedDoctor.currentHospital,
      address: updatedDoctor.address,
      location: updatedDoctor.location,
      schedule: updatedDoctor.schedule,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot password controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if doctor exists
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Generate OTP
    const otp = generateOTP();

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });

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
      // Increment attempts
      otpRecord.attempts += 1;

      // If max attempts reached, delete the OTP
      if (otpRecord.attempts >= 3) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({
          message: "Maximum attempts reached. Please request a new OTP",
        });
      }

      await otpRecord.save();
      return res.status(400).json({
        message: "Invalid OTP",
        attemptsLeft: 3 - otpRecord.attempts,
      });
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

    // Find doctor
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      // Clean up any remaining OTPs
      await OTP.deleteMany({ email });
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    doctor.password = hashedPassword;
    await doctor.save();

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

// Change password controller
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, doctor.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, doctor.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    doctor.password = hashedPassword;
    await doctor.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Toggle emergency availability controller
export const toggleEmergencyAvailability = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Toggle emergency availability
    doctor.emergencyAvailability = !doctor.emergencyAvailability;
    await doctor.save();

    res.json({
      message: `Emergency availability ${
        doctor.emergencyAvailability ? "enabled" : "disabled"
      }`,
      emergencyAvailability: doctor.emergencyAvailability,
    });
  } catch (error) {
    console.error("Toggle emergency availability error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Check approval status controller
export const checkApprovalStatus = async (req, res) => {
  try {
    // Extract doctor email from request
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Find doctor by email
    const doctor = await Doctor.findOne({ email }).select("isApproved name email");
    
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    
    res.json({
      isApproved: doctor.isApproved,
      name: doctor.name,
      email: doctor.email,
      message: doctor.isApproved 
        ? "Your account has been approved. You can now log in." 
        : "Your account is pending approval. Please wait for admin approval."
    });
  } catch (error) {
    console.error("Check approval status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get doctor emergency status controller
export const getEmergencyStatus = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json({
      emergencyAvailability: doctor.emergencyAvailability
    });
  } catch (error) {
    console.error("Get emergency status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

