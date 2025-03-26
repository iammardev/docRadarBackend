import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Admin from "../models/adminModel.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Check if token contains doctorId or userId
      if (decoded.doctorId) {
        // Token belongs to a doctor
        const doctor = await Doctor.findById(decoded.doctorId).select(
          "-password"
        );
        if (!doctor) {
          return res.status(401).json({ message: "Doctor not found" });
        }
        req.user = doctor;
        req.userType = "doctor";
      } else if (decoded.userId) {
        // Token belongs to a user
        const user = await User.findById(decoded.userId).select("-password");
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }
        req.user = user;
        req.userType = "user";
      } else {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Check if token contains doctorId or userId
      if (decoded.doctorId) {
        const doctor = await Doctor.findById(decoded.doctorId).select(
          "-password"
        );
        if (!doctor) {
          return res.status(401).json({ message: "Doctor not found" });
        }
        req.user = doctor;
        req.userType = "doctor";
      } else if (decoded.userId) {
        const user = await User.findById(decoded.userId).select("-password");
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }
        req.user = user;
        req.userType = "user";
      } else {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Middleware to ensure user is a doctor
export const doctorOnly = (req, res, next) => {
  if (req.userType !== "doctor") {
    return res.status(403).json({ message: "Access denied. Doctors only." });
  }
  next();
};

// Middleware to ensure user is a regular user
export const userOnly = (req, res, next) => {
  if (req.userType !== "user") {
    return res.status(403).json({ message: "Access denied. Users only." });
  }
  next();
};

// Middleware to ensure user is an admin
export const adminOnly = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({
        success: false, 
        message: "Not authorized, please login"
      });
    }

    try {
      // Verify with the same secret used in login
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (!decoded.adminId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin only."
        });
      }

      const admin = await Admin.findById(decoded.adminId).select("-password");
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Admin not found"
        });
      }

      req.admin = admin;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again"
      });
    }
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during authentication"
    });
  }
};
