import Booking from "../models/bookingModel.js";
import Doctor from "../models/doctorModel.js";
import RealtimeBooking from "../models/realtimeBookingModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";
import realtimeBookingBooking from "../models/realtimeBookingModel.js";

// Helper function to get day name from Date object
const getDayName = (date) => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
};

// Helper function to format time to "HH:MM" format
const formatTime = (hours, minutes) => {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Helper function to convert time string "HH:MM" to minutes since midnight
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper function to convert minutes since midnight to time string "HH:MM"
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return formatTime(hours, mins);
};

// Find nearby doctors
export const findNearbyDoctors = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 1400 } = req.body;

    if (!longitude || !latitude) {
      return res
        .status(400)
        .json({ message: "Location coordinates are required" });
    }

    // Convert distance from meters to kilometers for readability
    const distanceInKilometers = maxDistance / 1000;

    // Build the query
    const query = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: maxDistance, // in meters
        },
      },
    };

    // Find doctors within the specified radius
    const doctors = await Doctor.find(query)
      .select(
        "name specialty currentHospital address location emergencyAvailability schedule"
      )
      .lean();

    // Calculate and add distance to each doctor
    const doctorsWithDistance = doctors.map((doctor) => {
      // Calculate distance in kilometers
      const distance = calculateDistance(
        latitude,
        longitude,
        doctor.location.coordinates[1],
        doctor.location.coordinates[0]
      );

      return {
        ...doctor,
        distance: distance.toFixed(2) + " km",
      };
    });

    res.json({
      count: doctorsWithDistance.length,
      maxDistance: distanceInKilometers + " km",
      doctors: doctorsWithDistance,
    });
  } catch (error) {
    console.error("Find nearby doctors error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper function to calculate distance using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Get available slots for a doctor on a specific date
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    
    
    if (!doctorId || !date) {
      return res.status(400).json({ message: "Doctor ID and date are required" });
    }
    
    // Parse the date string into a Date object
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    
    // Set time to start of day for consistent date comparison
    selectedDate.setHours(0, 0, 0, 0);
    
    // Get the day of the week name (e.g., "Monday")
    const dayName = getDayName(selectedDate);
    
    // Find the doctor and check if they work on the selected day
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    
    // Check if the doctor works on this day
    if (!doctor.schedule || !doctor.schedule.workingDays.includes(dayName)) {
      return res.json({ 
        available: false,
        message: `Doctor does not work on ${dayName}`,
        slots: [] 
      });
    }
    
    // Get the doctor's working hours for this day
    const startTime = doctor.schedule.startTime || "09:00";
    const endTime = doctor.schedule.endTime || "17:00";
    const slotDuration = doctor.schedule.slotDuration || 30; // in minutes
    
    // Convert times to minutes since midnight for easier calculation
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    // Generate all possible slots for the day
    const allSlots = [];
    for (let time = startMinutes; time < endMinutes; time += slotDuration) {
      const slotStart = minutesToTime(time);
      const slotEnd = minutesToTime(time + slotDuration);
      
      allSlots.push({
        start: slotStart,
        end: slotEnd,
        formatted: `${slotStart} - ${slotEnd}`
      });
    }
    
    // Find all existing bookings for this doctor on this date
  //  const bookings = await Booking.find({
  //    doctor: doctorId,
  //    appointmentDate: {
   //     $gte: selectedDate,
   //     $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000) // Next day
   //   }
  //  }).select('slotStart slotEnd');

    const bookings = await Booking.find({
  doctor: doctorId,
  appointmentDate: {
    $gte: selectedDate,
    $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000) // Next day
  },
  status: { $nin: ["cancelled"] } // Add this line to exclude cancelled bookings
}).select('slotStart slotEnd');
    
    // Mark slots as booked
    const bookedSlots = bookings.map(booking => booking.slotStart);
    
    // Filter out booked slots
    const availableSlots = allSlots.filter(
      slot => !bookedSlots.includes(slot.start)
    );
    
    res.json({
      available: true,
      date: selectedDate,
      dayName,
      workingHours: `${startTime} - ${endTime}`,
      slots: availableSlots
    });
    
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get available dates for the next N days
export const getAvailableDates = async (req, res) => {
  try {
    const { doctorId, days = 14 } = req.query; // Default to 14 days (2 weeks)
    
    
    
    if (!doctorId) {
      return res.status(400).json({ message: "Doctor ID is required" });
    }
    
    // Find the doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    
    // Get the doctor's working days
    const workingDays = doctor.schedule?.workingDays || [];
    
    // Generate dates for the next N days
    const availableDates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight local time
    
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const formattedDate = date.toLocaleDateString("en-CA"); // Fix: YYYY-MM-DD in local time
      const dayName = getDayName(date);
      const isWorkingDay = workingDays.includes(dayName);
      
      availableDates.push({
        date: formattedDate,
        dayName,
        available: isWorkingDay
      });
    }
    
    res.json({
      workingDays,
      availableDates
    });
    
  } catch (error) {
    console.error("Get available dates error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a booking request
export const createBookingRequest = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      slotStart,
      slotEnd,
      symptoms,
      notes,
      emergencyRequest,
      longitude,
      latitude,
    } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!doctorId || !appointmentDate || !slotStart || !slotEnd) {
      return res.status(400).json({ message: "Doctor ID, appointment date, and slot times are required" });
    }

    // Find the doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if this slot is already booked
    const existingBooking = await Booking.findOne({
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      slotStart
    });

    if (existingBooking) {
      return res.status(400).json({ message: "This slot has already been booked" });
    }

    // Create a new booking
    const booking = await Booking.create({
      user: userId,
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      slotStart,
      slotEnd,
      symptoms,
      notes,
      emergencyRequest: emergencyRequest || false,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      status: "pending",
      fee: doctor.schedule?.consultationFee || 0
    });

    // Update user's bookings
    await User.findByIdAndUpdate(userId, {
      $push: { bookings: booking._id },
    });

    // Update doctor's bookings
    await Doctor.findByIdAndUpdate(doctorId, {
      $push: { bookings: booking._id },
    });

    // Return the booking with populated doctor details
    const populatedBooking = await Booking.findById(booking._id)
      .populate("doctor", "name specialty currentHospital")
      .populate("user", "name");

    res.status(201).json(populatedBooking);
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all booking requests for a doctor
export const getDoctorBookings = async (req, res) => {
  try {
    const doctorId = req.user._id;

    const bookings = await Booking.find({ doctor: doctorId })
      .populate("user", "name")
      .sort({ appointmentDate: 1, slotStart: 1 });

    res.json(bookings);
  } catch (error) {
    console.error("Get doctor bookings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all bookings for a user
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;

    const bookings = await Booking.find({ user: userId })
      .populate("doctor", "name specialty currentHospital")
      .sort({ appointmentDate: 1, slotStart: 1 });

    res.json(bookings);
  } catch (error) {
    console.error("Get user bookings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update booking status (accept/reject by doctor)
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId, status, fee } = req.body;
    const doctorId = req.user._id;

    // Validate status
    if (!["accepted", "rejected", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Find the booking and check if it belongs to the doctor
    const booking = await Booking.findOne({
      _id: bookingId,
      doctor: doctorId,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Update booking
    booking.status = status;
    if (fee && status === "accepted") {
      booking.fee = fee;
    }

    await booking.save();

    // Return the updated booking with populated user details
    const updatedBooking = await Booking.findById(booking._id)
      .populate("user", "name")
      .populate("doctor", "name specialty currentHospital");

    res.json(updatedBooking);
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Cancel booking (by user)
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user._id;

    // Find the booking and check if it belongs to the user
    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if the booking can be cancelled
    if (booking.status !== "pending" && booking.status !== "accepted") {
      return res.status(400).json({
        message: "Cannot cancel a booking that is not pending or accepted",
      });
    }

    // Update booking status
    booking.status = "cancelled";
    await booking.save();

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Complete booking (by doctor)
export const completeBooking = async (req, res) => {
  try {
    const { bookingId, notes } = req.body;
    const doctorId = req.user._id;

    // Find the booking and check if it belongs to the doctor
    const booking = await Booking.findOne({
      _id: bookingId,
      doctor: doctorId,
      status: "accepted",
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found or not in accepted status",
      });
    }

    // Update booking
    booking.status = "completed";
    if (notes) {
      booking.notes = notes;
    }

    await booking.save();

    res.json({ message: "Booking completed successfully", booking });
  } catch (error) {
    console.error("Complete booking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update doctor schedule
export const updateSchedule = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const { workingDays, startTime, endTime, slotDuration, consultationFee } = req.body;
    
    // Find the doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    
    // Initialize schedule if it doesn't exist
    if (!doctor.schedule) {
      doctor.schedule = {};
    }
    
    // Update schedule fields
    if (workingDays) doctor.schedule.workingDays = workingDays;
    if (startTime) doctor.schedule.startTime = startTime;
    if (endTime) doctor.schedule.endTime = endTime;
    if (slotDuration) doctor.schedule.slotDuration = slotDuration;
    if (consultationFee !== undefined) doctor.schedule.consultationFee = consultationFee;
    
    await doctor.save();
    
    res.json({
      message: "Schedule updated successfully",
      schedule: doctor.schedule
    });
    
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId)
      .populate('doctor', 'name specialty currentHospital')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the requesting user is authorized to view this booking
    if (booking.user._id.toString() !== req.user._id.toString() && 
        booking.doctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({ message: 'Error fetching booking details' });
  }
};

// Get all bookings (admin only)
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("doctor", "name specialty currentHospital")
      .sort({ appointmentDate: 1, slotStart: 1 });

    res.json(bookings);
  } catch (error) {
    console.error("Get all bookings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
