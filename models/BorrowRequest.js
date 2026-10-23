const mongoose = require('mongoose');

const borrowRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student/Member reference is required'],
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    decisionDate: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BorrowRequest', borrowRequestSchema);
