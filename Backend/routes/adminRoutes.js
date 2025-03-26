import express from "express";
import {
  adminLogin,
  adminLogout,
  getAllDoctors,
  getAllUsers,
  getAllBookings,
  approveDoctor,
  deleteDoctor,
  getDoctorApprovalRequests,
  deleteUser,
  getAdminProfile
} from "../controllers/adminController.js";
import { adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Admin auth routes (public)
router.post("/login", adminLogin);
router.post("/logout", adminLogout);
router.get("/profile", adminOnly, getAdminProfile);

// Protected admin routes
router.get("/doctors", adminOnly, getAllDoctors);
router.get("/doctors/approval-requests", adminOnly, getDoctorApprovalRequests);
router.put("/doctors/approve/:doctorId", adminOnly, approveDoctor);
router.delete("/doctors/:doctorId", adminOnly, deleteDoctor);

router.get("/users", adminOnly, getAllUsers);
router.get("/bookings", adminOnly, getAllBookings);
router.delete("/users/:userId", adminOnly, deleteUser);
export default router;
