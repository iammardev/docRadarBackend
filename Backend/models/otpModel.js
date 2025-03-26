import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true, // Add index for faster queries
  },
  otp: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // OTP expires after 10 minutes (600 seconds)
    index: true, // Add index for TTL
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3, // Maximum verification attempts
  },
});

// Compound index for email + createdAt for efficient sorting
otpSchema.index({ email: 1, createdAt: -1 });

const OTP = mongoose.model("OTP", otpSchema);

export default OTP;
