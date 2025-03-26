import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    stripeAccountId: {
      type: String,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    number: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    totalYearsOfExperience: {
      type: Number,
      required: true,
    },
    pmdcNumber: {
      type: String,
      required: true,
      unique: true,
    },
    specialty: {
      type: String,
      required: false,
    },
    category: {
      type: String,
      required: false,
    },
    qualification: {
      degree: String,
      collegeName: String,
    },
    schedule: {
      workingDays: [
        {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
      ],
      startTime: {
        type: String,
        default: "09:00", // 24-hour format
      },
      endTime: {
        type: String,
        default: "17:00", // 24-hour format
      },
      slotDuration: {
        type: Number,
        default: 30, // in minutes
      },
      consultationFee: {
        type: Number,
        required: false,
      },
    },
    hospitalDetails: [
      {
        schedule: {
          workingDays: [
            {
              type: String,
              enum: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ],
            },
          ],
          startTime: String,
          endTime: String,
          consultationFee: {
            type: Number,
            required: false,
          },
        },
      },
    ],
    clinicExperience: {
      clinicName: String,
      workingDays: [
        {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
      ],
      startTime: String,
      endTime: String,
      clinicFee: {
        type: Number,
        required: false,
      },
    },
    hospitalExperience: {
      hospitalName: String,
      yearsOfExperience: Number,
    },
    currentCity: {
      type: String,
      required: true,
    },
    currentHospital: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    assistantName: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false,
      },
    },
    emergencyAvailability: {
      type: Boolean,
      default: false,
    },
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
  },
  { timestamps: true }
);

// Create a 2dsphere index on the location field
doctorSchema.index({ location: "2dsphere" });

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
