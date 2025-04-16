import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    requestTime: {
      type: Date,
      default: Date.now,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    slotStart: {
      type: String, // format: "HH:MM" (24-hour)
      required: true,
    },
    slotEnd: {
      type: String, // format: "HH:MM" (24-hour)
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
    },
    
    fee: {
      type: Number,
      required: false,
    },
    paymentId: {
      type: String,
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Modified index to only enforce uniqueness for non-cancelled and non-completed bookings
bookingSchema.index(
  { doctor: 1, appointmentDate: 1, slotStart: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: { $nin: ['cancelled', 'completed'] } }
  }
);

// Index for geospatial queries if needed
bookingSchema.index({ location: "2dsphere" });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
