import mongoose from 'mongoose';

const paymentSchema = mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      required: true,
      default: 'stripe',
    },
    paymentDetails: {
      last4: {
        type: String,
      },
      cardType: {
        type: String,
      },
    },
    transferredToDoctor: {
      type: Boolean,
      default: false,
    },
    transferId: {
      type: String,
    },
    transferAmount: {
      type: Number,
    },
    refunded: {
      type: Boolean,
      default: false,
    },
    refundId: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 