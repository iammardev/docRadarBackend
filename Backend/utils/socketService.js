import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Doctor from "../models/doctorModel.js";
import User from "../models/userModel.js";
import RealtimeBooking from "../models/realtimeBookingModel.js";

let io;
const userSockets = new Map(); // userId -> socketId
const doctorSockets = new Map(); // doctorId -> socketId
const pendingRequests = new Map(); // requestId -> { userId, doctorIds[], acceptedDoctors[] }

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000","http://localhost:5174" , "http://localhost:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId || null;
      socket.doctorId = decoded.doctorId || null;
      socket.userType = decoded.userId ? "user" : "doctor";

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Store socket connection based on user type
    if (socket.userType === "user" && socket.userId) {
      userSockets.set(socket.userId.toString(), socket.id);
      console.log(`User connected: ${socket.userId}`);
    } else if (socket.userType === "doctor" && socket.doctorId) {
      doctorSockets.set(socket.doctorId.toString(), socket.id);
      console.log(`Doctor connected: ${socket.doctorId}`);
    }

    // Handle nearby doctor request from user
    socket.on("nearby_doctor_request", async (data) => {
      try {
        const { location, specialty } = data;
        const userId = socket.userId;
        const requestId = generateRequestId();

        const userDetails = await User.findById(userId).select("name number");
        if (!userDetails) {
          io.to(socket.id).emit("emergency_search_error", {
            message: "User details not found",
          });
          return;
        }

        // Find nearby doctors with matching specialty
        const nearbyDoctors = await findNearbyDoctors(
          location.coordinates[0], // longitude
          location.coordinates[1], // latitude
          20000, // max distance in meters
          specialty
        );
        console.log( "test" , nearbyDoctors);
        if (nearbyDoctors.length === 0) {
          io.to(socket.id).emit("no_doctors_available", {
            message: "No doctors available nearby with the selected specialty",
          });
          return;
        }

        // Create a pending request record
        pendingRequests.set(requestId, {
          userId,
          location,
          specialty,
          requestId,
          doctorIds: nearbyDoctors.map((doctor) => doctor._id.toString()),
          acceptedDoctors: [],
          timestamp: Date.now(),
        });

        // Send request to all nearby doctors
        nearbyDoctors.forEach((doctor) => {
          const doctorSocketId = doctorSockets.get(doctor._id.toString());
          if (doctorSocketId) {
            io.to(doctorSocketId).emit("booking_request", {
              requestId,
              userId,
              location,
              specialty,
              userDistance: doctor.distance,
              userName: userDetails.name,
              userNumber: userDetails.number,
            });
          }
        });

        // Start a timeout to collect responses from doctors
        setTimeout(() => {
          handleRequestTimeout(requestId);
        }, 30000); // 30 seconds timeout

        // Send confirmation to the user
        io.to(socket.id).emit("request_sent", {
          requestId,
          message: `Request sent to ${nearbyDoctors.length} doctors`,
        });
      } catch (error) {
        console.error("Nearby doctor request error:", error);
        io.to(socket.id).emit("request_error", {
          message: "Error processing your request",
        });
      }
    });

    // Handle doctor accepting a request
    socket.on("accept_request", async (data) => {
      try {
        const { requestId } = data;
        const doctorId = socket.doctorId;

        if (!pendingRequests.has(requestId)) {
          io.to(socket.id).emit("request_expired", {
            message: "This request has expired or no longer exists",
          });
          return;
        }

        const request = pendingRequests.get(requestId);

        // Add doctor to the accepted list
        const doctorDetails = await Doctor.findById(doctorId).select(
          "name specialty currentHospital address schedule"
        );
        
        const acceptedDoctor = {
          doctorId,
          name: doctorDetails.name,
          specialty: doctorDetails.specialty,
          hospital: doctorDetails.currentHospital,
          address: doctorDetails.address,
          fee: doctorDetails.schedule.consultationFee
        };

        request.acceptedDoctors.push(acceptedDoctor);
        pendingRequests.set(requestId, request);

        // Notify the user about the new doctor acceptance
        const userSocketId = userSockets.get(request.userId);
        if (userSocketId) {
          io.to(userSocketId).emit("doctor_accepted", {
            requestId,
            doctor: acceptedDoctor,
          });
        }
      } catch (error) {
        console.error("Accept request error:", error);
        io.to(socket.id).emit("accept_error", {
          message: "Error accepting the request",
        });
      }
    });

    // Handle user selecting a doctor
    socket.on("select_doctor", async (data) => {
      try {
        const { requestId, doctorId } = data;
        const userId = socket.userId;

        if (!pendingRequests.has(requestId)) {
          io.to(socket.id).emit("selection_error", {
            message: "This request has expired or no longer exists",
          });
          return;
        }

        const request = pendingRequests.get(requestId);

        // Find the selected doctor in the accepted list
        const selectedDoctor = request.acceptedDoctors.find(
          (doctor) => doctor.doctorId.toString() === doctorId
        );

        if (!selectedDoctor) {
          io.to(socket.id).emit("selection_error", {
            message: "Selected doctor not found in the accepted list",
          });
          return;
        }

        // Create a new realtime booking in the database
        const newBooking = new RealtimeBooking({
          user: userId,
          doctor: doctorId,
          specialty: request.specialty,
          location: request.location,
          status: 'pending',
          fee: selectedDoctor.fee || 0
        });

        // Save the booking to the database
        await newBooking.save();
        
        // Notify the selected doctor
        const doctorSocketId = doctorSockets.get(doctorId);
        if (doctorSocketId) {
          io.to(doctorSocketId).emit("booking_confirmed", {
            requestId,
            userId,
            bookingId: newBooking._id,
            location: request.location,
          });
        }

        // Notify the user that booking was created and redirect to payment
        const userSocketId = userSockets.get(userId.toString());
        if (userSocketId) {
          io.to(userSocketId).emit("booking_created", {
            bookingId: newBooking._id,
            doctor: selectedDoctor,
            redirectToPayment: true
          });
        }

        // Notify other doctors that they were not selected
        request.acceptedDoctors
          .filter((doctor) => doctor.doctorId.toString() !== doctorId)
          .forEach((doctor) => {
            const otherDoctorSocketId = doctorSockets.get(
              doctor.doctorId.toString()
            );
            if (otherDoctorSocketId) {
              io.to(otherDoctorSocketId).emit("booking_cancelled", {
                requestId,
                message: "Another doctor was selected for this booking",
              });
            }
          });

        // Remove the request from pending requests
        pendingRequests.delete(requestId);
      } catch (error) {
        console.error("Select doctor error:", error);
        io.to(socket.id).emit("selection_error", {
          message: "Error selecting the doctor",
        });
      }
    });

    // Handle emergency doctor search request
    socket.on("emergency_doctor_search", async (data) => {
      try {
        const { location } = data;
        const userId = socket.userId;
        const requestId = generateRequestId();

        const userDetails = await User.findById(userId).select("name number");
        if (!userDetails) {
          io.to(socket.id).emit("emergency_search_error", {
            message: "User details not found",
          });
          return;
        }

        // Find nearby doctors with emergency availability
        const nearbyDoctors = await findEmergencyDoctors(
          location.coordinates[0], // longitude
          location.coordinates[1], // latitude
          20000, // max distance in meters
        );

        if (nearbyDoctors.length === 0) {
          io.to(socket.id).emit("no_emergency_doctors", {
            message: "No emergency doctors available nearby",
          });
          return;
        }

        // Create a pending emergency request record
        pendingRequests.set(requestId, {
          userId,
          location,
          requestId,
          doctorIds: nearbyDoctors.map((doctor) => doctor._id.toString()),
          timestamp: Date.now(),
        });

        // Send request to all nearby emergency doctors
        nearbyDoctors.forEach((doctor) => {
          const doctorSocketId = doctorSockets.get(doctor._id.toString());
          if (doctorSocketId) {
            io.to(doctorSocketId).emit("emergency_search_request", {
              requestId,
              userId,
              location,
              userDistance: doctor.distance,
               userName: userDetails.name,
              userNumber: userDetails.number,
            });
          }
        });

        // Send confirmation to the user with doctor details
        io.to(socket.id).emit("emergency_doctors_found", {
          requestId,
          doctors: nearbyDoctors.map(doctor => ({
            doctorId: doctor._id,
            name: doctor.name,
            specialty: doctor.specialty,
            hospital: doctor.currentHospital,
            address: doctor.address,
            phone: doctor.number,
            distance: doctor.distance
          })),
          message: `Found ${nearbyDoctors.length} emergency doctors nearby`,
        });

      } catch (error) {
        console.error("Emergency doctor search error:", error);
        io.to(socket.id).emit("emergency_search_error", {
          message: "Error searching for emergency doctors",
        });
      }
    });

    // Handle doctor accepting emergency request
    socket.on("accept_emergency_request", async (data) => {
      try {
        const { requestId } = data;
        const doctorId = socket.doctorId;

        if (!pendingRequests.has(requestId)) {
          io.to(socket.id).emit("request_expired", {
            message: "This request has expired or no longer exists",
          });
          return;
        }

        const request = pendingRequests.get(requestId);
        const doctorDetails = await Doctor.findById(doctorId).select(
          "name specialty currentHospital address phone"
        );

        // Notify the user about the doctor acceptance
        const userSocketId = userSockets.get(request.userId);
        if (userSocketId) {
          io.to(userSocketId).emit("emergency_doctor_accepted", {
            requestId,
            doctor: {
              doctorId,
              name: doctorDetails.name,
              specialty: doctorDetails.specialty,
              hospital: doctorDetails.currentHospital,
              address: doctorDetails.address,
              phone: doctorDetails.number
            },
          });
        }

        // Remove the request from pending requests
        pendingRequests.delete(requestId);
      } catch (error) {
        console.error("Accept emergency request error:", error);
        io.to(socket.id).emit("accept_error", {
          message: "Error accepting the emergency request",
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      if (socket.userType === "user" && socket.userId) {
        userSockets.delete(socket.userId.toString());
        console.log(`User disconnected: ${socket.userId}`);
      } else if (socket.userType === "doctor" && socket.doctorId) {
        doctorSockets.delete(socket.doctorId.toString());
        console.log(`Doctor disconnected: ${socket.doctorId}`);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Handle request timeout
function handleRequestTimeout(requestId) {
  if (!pendingRequests.has(requestId)) {
    return;
  }

  const request = pendingRequests.get(requestId);
  const userSocketId = userSockets.get(request.userId);

  if (request.acceptedDoctors.length === 0) {
    // No doctors accepted the request
    if (userSocketId) {
      io.to(userSocketId).emit("no_doctor_accepted", {
        requestId,
        message: "No doctors accepted your request within the time limit",
      });
    }
  } else {
    // Some doctors accepted - already handled in real-time
    // Just make sure the user knows all doctors who accepted
    if (userSocketId) {
      io.to(userSocketId).emit("request_timeout", {
        requestId,
        message: "Request time limit reached. Please select a doctor",
        acceptedDoctors: request.acceptedDoctors,
      });
    }
  }

  // After some additional time, clean up this request if not handled
  setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
    }
  }, 60000); // 1 minute additional cleanup time
}

// Find nearby doctors
async function findNearbyDoctors(longitude, latitude, maxDistance, specialty) {
  try {
    const query = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: maxDistance,
        },
      },
      specialty: specialty,
      isApproved: true
    };

    const doctors = await Doctor.find(query).select("name specialty currentHospital location schedule");

    // Calculate and add distance to each doctor
    return doctors.map((doctor) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        doctor.location.coordinates[1],
        doctor.location.coordinates[0]
      );

      return {
        ...doctor._doc,
        distance: distance.toFixed(2) + " km",
      };
    });
  } catch (error) {
    console.error("Find nearby doctors error:", error);
    throw error;
  }
}

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

// Generate a random request ID
function generateRequestId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Find emergency doctors
async function findEmergencyDoctors(longitude, latitude, maxDistance) {
  try {
    const query = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: maxDistance,
        },
      },
      emergencyAvailability: true,
      isApproved: true
    };

    const doctors = await Doctor.find(query).select("name specialty currentHospital location number");

    // Calculate and add distance to each doctor
    return doctors.map((doctor) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        doctor.location.coordinates[1],
        doctor.location.coordinates[0]
      );

      return {
        ...doctor._doc,
        distance: distance.toFixed(2) + " km",
      };
    });
  } catch (error) {
    console.error("Find emergency doctors error:", error);
    throw error;
  }
}

// Export the socket instance getter
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
