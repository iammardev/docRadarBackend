
# DocRadar — Backend

Backend for **DocRadar**, a healthcare app connecting patients with nearby
doctors. Powers real-time booking, location-based doctor search, OTP auth, and
secure payments for a React Native client. Built with Node.js / Express,
MongoDB, and Socket.IO.

## Features
- **Roles** — patient / doctor / admin flows with JWT auth middleware
- **OTP verification** — one-time-password verification
- **Nearby-doctor search** — geolocation via a geocoding service
- **Real-time booking** — live updates over Socket.IO
- **Payments** — Stripe for appointment/consultation fees

## Project structure
config/       # DB connection
controllers/  # user, doctor, booking, payment, admin, doc
middlewares/  # authMiddleware (JWT)
models/       # user, doctor, booking, realtimeBooking, otp, payment, admin
routes/       # user, doctor, booking, payment, admin
utils/        # socketService, geocodeService, emailServices

## Tech stack
Node.js + Express · MongoDB (Mongoose) · Socket.IO · Stripe · Google Maps geocoding

## Getting started
```bash
cd Backend
npm install
cp .env.example .env    # MONGO_URI, stripeKey, JWT_SECRET, etc.
npm start

▎ All secrets read from process.env via .env (not committed).
