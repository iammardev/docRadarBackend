import express from "express";
import {
  signUp,
  login,
  logout,
  refreshToken,
  forgotPassword,
  verifyOTP,
  resetPassword,
  updateProfile,
  changePassword,
  getUserProfile,
  searchDoctorByCategory,
  getDoctorProfile
} from "../controllers/userController.js";
import {
  protect,
  verifyRefreshToken,
  userOnly,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Authentication routes
router.post("/signup", signUp);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", verifyRefreshToken, refreshToken);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// Protected routes (users only)
router.get("/profile", protect, userOnly, getUserProfile);
router.put("/profile", protect, userOnly, updateProfile);
router.put("/change-password", protect, userOnly, changePassword);
router.post("/search-doctor/specialty", protect, userOnly, searchDoctorByCategory);
router.get("/doctor-profile/:id", protect,  getDoctorProfile);
export default router;
