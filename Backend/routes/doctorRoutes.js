import express from "express";
import {
  signUp,
  login,
  logout,
  refreshToken,
  getDoctorProfile,
  updateDoctorProfile,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
  toggleEmergencyAvailability,
  checkApprovalStatus
} from "../controllers/docController.js";
import {
  protect,
  verifyRefreshToken,
  doctorOnly,
} from "../middlewares/authMiddleware.js";
import { updateSchedule } from "../controllers/bookingController.js";

const router = express.Router();

// Authentication routes
router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout",protect, logout);
router.post("/refresh-token", verifyRefreshToken, refreshToken);
router.post("/check-approval", checkApprovalStatus);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/profile", protect, getDoctorProfile);
router.put("/profile", protect, doctorOnly, updateDoctorProfile);
router.put("/change-password", protect, doctorOnly, changePassword);
router.post(
  "/toggle-emergency",
  protect,
  doctorOnly,
  toggleEmergencyAvailability
);

// Schedule management
router.put("/schedule", protect, doctorOnly, updateSchedule);

export default router;
