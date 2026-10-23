const express = require('express');
const router = express.Router();
const {
  createBorrowRequest,
  getMyBorrowRequests,
  getAllBorrowRequests,
  approveBorrowRequest,
  rejectBorrowRequest,
} = require('../controllers/borrowRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Logged-in user routes (Must be defined before parameterized routes)
router.get('/my', protect, getMyBorrowRequests);
router.post('/', protect, createBorrowRequest);

// Admin-only management routes
router.get('/', protect, authorize('admin'), getAllBorrowRequests);
router.put('/:id/approve', protect, authorize('admin'), approveBorrowRequest);
router.put('/:id/reject', protect, authorize('admin'), rejectBorrowRequest);

module.exports = router;
