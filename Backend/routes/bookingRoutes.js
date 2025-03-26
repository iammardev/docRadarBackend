import express from "express";
import {
  findNearbyDoctors,
  createBookingRequest,
  getDoctorBookings,
  getUserBookings,
  updateBookingStatus,
  cancelBooking,
  completeBooking,
  getAvailableSlots,
  getAvailableDates,
  updateSchedule,
  getBookingById
} from "../controllers/bookingController.js";
import {
  protect,
  doctorOnly,
  userOnly,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes accessible to all users
router.post("/find-nearby-doctors", findNearbyDoctors);

// Routes for getting available slots and dates
router.get("/available-slots", getAvailableSlots);
router.get("/available-dates", getAvailableDates);

// Protected routes for authenticated users
router.post("/request", protect, createBookingRequest);
router.get("/user-bookings", protect, userOnly, getUserBookings);
router.put("/cancel", protect, cancelBooking);

// Protected routes for doctors
router.get("/doctor-bookings", protect, doctorOnly, getDoctorBookings);
router.put("/update-status", protect, doctorOnly, updateBookingStatus);
router.put("/complete", protect, doctorOnly, completeBooking);
router.put("/update-schedule", protect, doctorOnly, updateSchedule);
router.get("/booking/:bookingId", protect, getBookingById);
export default router;
