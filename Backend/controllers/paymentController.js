import dotenv from 'dotenv';
import stripe from 'stripe';
import asyncHandler from 'express-async-handler';
import Booking from '../models/bookingModel.js';
import RealtimeBooking from '../models/realtimeBookingModel.js';
import Payment from '../models/paymentModel.js';

dotenv.config();

// Initialize Stripe with the API key
const stripeClient = stripe(process.env.stripeKey);

// Helper function to find booking in either model
const findBooking = async (bookingId, options = {}) => {
  // First try to find in regular bookings
  let booking = await Booking.findById(bookingId);
  
  // If not found, try realtime bookings
  if (!booking) {
    booking = await RealtimeBooking.findById(bookingId);
  }
  
  // If still not found, return null
  if (!booking) {
    return null;
  }

  // Handle population if requested
  if (options.populate) {
    const populateOptions = Array.isArray(options.populate) 
      ? options.populate 
      : [options.populate];
    
    for (const path of populateOptions) {
      await booking.populate(path);
    }
  }
  
  // Return the Mongoose document
  return booking;
};

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    res.status(400);
    throw new Error('Missing required payment information');
  }

  // Get booking information to verify details
  const booking = await findBooking(bookingId);
  
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Verify that the user making the payment is the one who created the booking
  if (booking.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Unauthorized to process this payment');
  }

  try {
    // Create a payment intent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(booking.fee * 100), // Stripe requires amount in cents
      currency: 'usd',
      metadata: {
        bookingId,
        userId: req.user._id.toString(),
        bookingType: booking instanceof RealtimeBooking ? 'realtime' : 'regular'
      },
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    res.status(400);
    throw new Error(error.message || 'Failed to create payment intent');
  }
});

/**
 * @desc    Process payment confirmation
 * @route   POST /api/payments/confirm
 * @access  Private
 */
const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId, bookingId } = req.body;

  if (!paymentIntentId || !bookingId) {
    res.status(400);
    throw new Error('Missing required payment information');
  }

  // Get booking information to verify details
  const booking = await findBooking(bookingId);
  
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  try {
    // Retrieve the payment intent to check its status
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      res.status(400);
      throw new Error('Payment has not been completed');
    }

    // Create a new payment record in the database
    const payment = await Payment.create({
      booking: bookingId,
      user: req.user._id,
      amount: booking.fee,
      paymentId: paymentIntent.id,
      status: 'succeeded',
      paymentMethod: 'stripe',
      paymentDetails: {
        last4: paymentIntent.payment_method_details?.card?.last4 || 'N/A',
        cardType: paymentIntent.payment_method_details?.card?.brand || 'Unknown',
      },
    });

    // Update booking status to paid
    booking.paymentStatus = 'paid';
    booking.payment = payment._id;
    await booking.save();

    res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        timestamp: payment.createdAt,
      },
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(400);
    throw new Error(error.message || 'Payment confirmation failed');
  }
});

/**
 * @desc    Process refund for a payment
 * @route   POST /api/payments/refund
 * @access  Private (Admin or Doctor)
 */
const processRefund = asyncHandler(async (req, res) => {
  const { paymentId } = req.body;

  if (!paymentId) {
    res.status(400);
    throw new Error('Payment ID is required');
  }

  // Find the payment record
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  // Check if payment is already refunded
  if (payment.refunded) {
    res.status(400);
    throw new Error('Payment has already been refunded');
  }

  // Verify authorization - only admin or the doctor associated with the booking can refund
  const booking = await findBooking(payment.booking);
  
  if (!booking) {
    res.status(404);
    throw new Error('Associated booking not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isAssociatedDoctor = booking.doctor && 
                           booking.doctor.toString() === req.user._id.toString() &&
                           req.user.role === 'doctor';

  if (!isAdmin && !isAssociatedDoctor) {
    res.status(403);
    throw new Error('Not authorized to process refunds');
  }

  try {
    // Process the refund through Stripe
    const refundAmount = payment.amount; // Refund the entire amount
    
    const refund = await stripeClient.refunds.create({
      payment_intent: payment.paymentId,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: {
        reason: 'Customer requested refund',
        refundedBy: req.user._id.toString(),
        bookingId: booking._id.toString(),
        bookingType: booking instanceof RealtimeBooking ? 'realtime' : 'regular'
      }
    });

    // Update payment record
    payment.refunded = true;
    payment.refundId = refund.id;
    payment.refundAmount = refundAmount;
    payment.refundReason = 'Customer requested refund';
    await payment.save();

    // Update booking status
    booking.paymentStatus = 'refunded';
    await booking.save();

    res.status(200).json({
      success: true,
      refund: {
        id: refund.id,
        amount: refundAmount,
        status: refund.status,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(400);
    throw new Error(error.message || 'Refund processing failed');
  }
});

/**
 * @desc    Get payment status by ID
 * @route   GET /api/payments/status/:paymentId
 * @access  Private
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  // Check if the user is authorized to see this payment
  if (payment.user.toString() !== req.user._id.toString() && 
      req.user.role !== 'admin' && 
      req.user.role !== 'doctor') {
    res.status(403);
    throw new Error('Not authorized to access this payment');
  }

  res.status(200).json({
    success: true,
    payment: {
      id: payment._id,
      status: payment.status,
      amount: payment.amount,
      method: payment.paymentMethod,
      timestamp: payment.createdAt,
      booking: payment.booking,
      refunded: payment.refunded,
      refundAmount: payment.refundAmount,
      refundReason: payment.refundReason
    },
  });
});

/**
 * @desc    Get all payments (admin only)
 * @route   GET /api/payments/all
 * @access  Admin
 */
const getAllPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({})
    .populate('user', 'name email')
    .populate('booking', 'appointmentDate slotStart status');

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

/**
 * @desc    Transfer payment to doctor after appointment completion
 * @route   POST /api/payments/transfer-to-doctor
 * @access  Private (Doctor only)
 */
const transferToDoctor = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const doctorId = req.user._id;

  // Find the booking with populated payment and doctor
  const booking = await findBooking(bookingId, {
    populate: ['payment', 'doctor']
  });

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Verify this is the correct doctor
  if (booking.doctor._id.toString() !== doctorId.toString()) {
    res.status(403);
    throw new Error('Not authorized to receive this payment');
  }

  // Check if payment exists and has been made
  if (!booking.payment || booking.payment.status !== 'succeeded') {
    res.status(400);
    throw new Error('No successful payment found for this booking');
  }

  // Check if transfer has already been made
  if (booking.payment.transferredToDoctor) {
    res.status(400);
    throw new Error('Payment has already been transferred to doctor');
  }

  try {
    // Calculate doctor's share (90% of the payment)
    const amount = Math.round(booking.payment.amount * 90); // Amount in cents

    // Create a transfer to the doctor's connected account
    const transfer = await stripeClient.transfers.create({
      amount: amount,
      currency: 'usd',
      destination: booking.doctor.stripeAccountId,
      transfer_group: `booking_${bookingId}`,
      metadata: {
        bookingId: bookingId,
        doctorId: doctorId.toString(),
        type: 'doctor_payment',
        bookingType: booking instanceof RealtimeBooking ? 'realtime' : 'regular'
      }
    });

    // Update payment record
    booking.payment.transferredToDoctor = true;
    booking.payment.transferId = transfer.id;
    booking.payment.transferAmount = amount / 100; // Store in dollars
    await booking.payment.save();

    res.status(200).json({
      success: true,
      transfer: {
        id: transfer.id,
        amount: amount / 100,
        status: transfer.status
      }
    });
  } catch (error) {
    console.error('Transfer to doctor error:', error);
    res.status(400);
    throw new Error(error.message || 'Failed to transfer payment to doctor');
  }
});

/**
 * @desc    Process refund for cancelled booking
 * @route   POST /api/payments/refund-booking
 * @access  Private
 */
const refundBookingPayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const userId = req.user._id;

  // Get booking information to verify details
  const booking = await findBooking(bookingId);
  
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Verify that the user making the refund is authorized
  if (booking.user.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Unauthorized to process this refund');
  }

  try {
    // Process the refund through Stripe
    const refund = await stripeClient.refunds.create({
      payment_intent: booking.payment.paymentId,
      metadata: {
        bookingId: bookingId,
        reason: 'booking_cancelled',
        cancelledBy: userId.toString(),
        bookingType: booking instanceof RealtimeBooking ? 'realtime' : 'regular'
      }
    });

    // Update payment record
    booking.payment.refunded = true;
    booking.payment.refundId = refund.id;
    booking.payment.refundAmount = booking.payment.amount;
    booking.payment.refundReason = 'Booking cancelled';
    await booking.payment.save();

    // Update booking status
    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    await booking.save();

    res.status(200).json({
      success: true,
      refund: {
        id: refund.id,
        amount: booking.payment.amount,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(400);
    throw new Error(error.message || 'Failed to process refund');
  }
});

export { 
  createPaymentIntent, 
  confirmPayment, 
  processRefund, 
  getPaymentStatus, 
  getAllPayments,
  transferToDoctor,
  refundBookingPayment 
}; 