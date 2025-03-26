import express from "express";
import {
  createPaymentIntent,
  confirmPayment,
  processRefund,
  getPaymentStatus,
  getAllPayments,
  transferToDoctor,
  refundBookingPayment
} from "../controllers/paymentController.js";
import {
  protect,
  doctorOnly,
  adminOnly
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Create payment intent (first step)
router.post("/create-intent", protect, createPaymentIntent);

// Confirm payment (after client-side processing)
router.post("/confirm", protect, confirmPayment);

// Process refund route (admin or doctor only)
router.post("/refund", protect, processRefund);

// Get payment status by ID
router.get("/status/:paymentId", protect, getPaymentStatus);

// Get all payments (admin only)
router.get("/all", adminOnly, getAllPayments);

// Transfer to doctor route (doctor only)
router.post("/transfer-to-doctor", protect, doctorOnly, transferToDoctor);

// Refund booking payment route (protected)
router.post("/refund-booking", protect, refundBookingPayment);

export default router; 